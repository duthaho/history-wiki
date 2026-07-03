import { Command } from 'commander';
import { globSync } from 'glob';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getArticlesByEra } from './fetcher/article-list.js';
import { RawStore } from './fetcher/raw-store.js';
import { fetchArticle } from './fetcher/wiki-api.js';
import { buildCityFile, buildGraphFile } from './graph/build-graph.js';
import { ingestArticle, ingestDiscoveredArticle, normalizePage, parseWikiPage } from './ingester/ingester.js';
import { findUnresolvedLinks } from './linker/link-resolver.js';
import type { LLMProvider } from './llm/index.js';
import { createLLMClient, DEFAULT_MODELS } from './llm/index.js';
import { queryWiki } from './query/query-engine.js';
import { VALID_ERAS } from './schema/schema.js';
import { WikiManager } from './wiki/wiki-manager.js';

const VALID_PROVIDERS: LLMProvider[] = ['anthropic', 'nvidia'];

const ROOT = process.cwd();
const rawStore = new RawStore(join(ROOT, 'raw'));
const wiki = new WikiManager(join(ROOT, 'wiki'));

const program = new Command();

program
  .name('vn-wiki')
  .description('Vietnam History LLM Wiki — Knowledge base from Vietnamese Wikipedia')
  .version('0.1.0');

program
  .command('ingest')
  .description('Fetch and compile Wikipedia articles into wiki pages')
  .argument('<era>', 'Era to ingest (e.g., prehistoric)')
  .option('--provider <provider>', 'LLM provider (anthropic|nvidia)', 'nvidia')
  .option('--model <model>', 'Model to use (defaults per provider)')
  .option('--skip-existing', 'Skip articles already in wiki', false)
  .action(async (era: string, opts: { provider: string; model?: string; skipExisting: boolean }) => {
    if (!VALID_ERAS.includes(era as any)) {
      console.error(`Invalid era: ${era}\nAvailable eras: ${VALID_ERAS.join(', ')}`);
      process.exit(1);
    }

    const provider = opts.provider as LLMProvider;
    if (!VALID_PROVIDERS.includes(provider)) {
      console.error(`Invalid provider: ${provider}\nAvailable: ${VALID_PROVIDERS.join(', ')}`);
      process.exit(1);
    }

    const model = opts.model ?? DEFAULT_MODELS[provider];
    const client = createLLMClient(provider);
    console.log(`Using ${provider} (${model})\n`);
    const articles = getArticlesByEra(era as any);

    if (articles.length === 0) {
      console.error(`Era "${era}" is valid but has no articles yet.`);
      process.exit(1);
    }

    console.log(`Found ${articles.length} articles for era: ${era}\n`);

    for (let i = 0; i < articles.length; i++) {
      const entry = articles[i];
      console.log(`[${i + 1}/${articles.length}] ${entry.wikiTitle}`);

      try {
        const slug = entry.wikiTitle.toLowerCase().replace(/\s+/g, '-');
        const category = entry.type === 'dynasty' ? 'eras' : `${entry.type}s`;

        // Skip if wiki page already exists
        if (opts.skipExisting) {
          const existing = await wiki.loadPage(category, slug);
          if (existing) {
            console.log('  -> Skipped (already exists)');
            continue;
          }
        }

        // Fetch from Wikipedia
        if (await rawStore.exists(era, entry.title)) {
          console.log('  -> Raw: cached');
        } else {
          console.log('  -> Fetching from vi.wikipedia.org...');
          const article = await fetchArticle(entry.title);
          await rawStore.save(era, article);
          console.log('  -> Raw: saved');
        }

        // Load raw content
        const raw = await rawStore.load(era, entry.title);
        if (!raw) throw new Error('Failed to load raw article');

        // Ingest with LLM
        console.log(`  -> Compiling with ${provider}...`);
        const wikiPage = await ingestArticle(client, entry, raw.content, model);

        // Save wiki page
        await wiki.savePage(category, slug, wikiPage);
        console.log(`  -> Wiki: saved -> wiki/${category}/${slug}.md`);
      } catch (err) {
        console.error(`  -> Error: ${err instanceof Error ? err.message : err}`);
      }

      console.log();
    }

    console.log('Done! Run `vn-wiki list` to see all pages.');
  });

program
  .command('query')
  .description('Ask a question about Vietnamese history')
  .argument('<question>', 'Your question in Vietnamese')
  .option('--provider <provider>', 'LLM provider (anthropic|nvidia)', 'nvidia')
  .option('--model <model>', 'Model to use (defaults per provider)')
  .action(async (question: string, opts: { provider: string; model?: string }) => {
    const provider = opts.provider as LLMProvider;
    const model = opts.model ?? DEFAULT_MODELS[provider];
    const client = createLLMClient(provider);
    console.log(`\nUsing ${provider} (${model})`);
    console.log(`Searching wiki for: "${question}"\n`);
    const answer = await queryWiki(client, wiki, question, model);
    console.log(answer);
  });

program
  .command('list')
  .description('List all wiki pages')
  .action(async () => {
    const pages = await wiki.listPages();
    if (pages.length === 0) {
      console.log('No wiki pages yet. Run `vn-wiki ingest prehistoric` to get started.');
      return;
    }
    console.log(`\n${pages.length} wiki pages:\n`);
    for (const page of pages) {
      console.log(`  [${page.era}] ${page.title} (${page.type}) -> ${page.path}`);
    }
  });

program
  .command('normalize')
  .description('Fix malformed frontmatter in all wiki pages')
  .option('--dry-run', 'Show what would change without writing', false)
  .action(async (opts: { dryRun: boolean }) => {
    const wikiDir = join(ROOT, 'wiki');
    const files = globSync('**/*.md', { cwd: wikiDir });
    let fixed = 0;

    for (const file of files) {
      const filePath = join(wikiDir, file);
      const original = await readFile(filePath, 'utf-8');
      const normalized = normalizePage(original);

      if (original !== normalized) {
        fixed++;
        console.log(`  fix: ${file}`);
        if (!opts.dryRun) {
          const { writeFile: wf } = await import('node:fs/promises');
          await wf(filePath, normalized, 'utf-8');
        }
      }
    }

    if (fixed === 0) {
      console.log('All wiki pages are well-formed.');
    } else {
      console.log(`\n${fixed}/${files.length} pages ${opts.dryRun ? 'need fixing' : 'fixed'}.`);
    }
  });

program
  .command('build-graph')
  .description('Generate interactive graph visualization of the wiki')
  .option('-o, --output <path>', 'Output HTML file path', 'dist/graph.html')
  .action(async (opts: { output: string }) => {
    const wikiDir = join(ROOT, 'wiki');
    const outputPath = join(ROOT, opts.output);
    console.log('Building graph...');
    const { nodeCount, edgeCount } = await buildGraphFile(wikiDir, outputPath);
    console.log(`Generated ${outputPath}`);
    console.log(`  ${nodeCount} nodes, ${edgeCount} edges`);
    console.log(`\nOpen in browser to explore.`);
  });

program
  .command('build-city')
  .description('Generate the 3D knowledge-city visualization of the wiki')
  .option('-o, --output <path>', 'Output HTML file path', 'dist/city.html')
  .action(async (opts: { output: string }) => {
    const wikiDir = join(ROOT, 'wiki');
    const outputPath = join(ROOT, opts.output);
    console.log('Building city...');
    const { nodeCount, edgeCount } = await buildCityFile(wikiDir, outputPath);
    console.log(`Generated ${outputPath}`);
    console.log(`  ${nodeCount} buildings, ${edgeCount} links`);
    console.log(`\nOpen in browser to stroll the old town.`);
  });

program
  .command('follow-links')
  .description('Discover and ingest articles referenced by existing wiki pages')
  .argument('[source]', 'Wiki file or directory to scan (e.g. people/hung-vuong.md, eras/). Defaults to all.')
  .option('--depth <n>', 'How many rounds of link following', '1')
  .option('--provider <provider>', 'LLM provider (anthropic|nvidia)', 'nvidia')
  .option('--model <model>', 'Model to use (defaults per provider)')
  .option('--dry-run', 'Show what would be fetched without ingesting', false)
  .action(async (source: string | undefined, opts: { depth: string; provider: string; model?: string; dryRun: boolean }) => {
    const provider = opts.provider as LLMProvider;
    const model = opts.model ?? DEFAULT_MODELS[provider];
    const client = createLLMClient(provider);
    console.log(`Using ${provider} (${model})\n`);
    const wikiDir = join(ROOT, 'wiki');
    const depth = parseInt(opts.depth, 10);

    for (let round = 1; round <= depth; round++) {
      console.log(`\n--- Round ${round}/${depth} ---\n`);

      // Read wiki pages (filtered by source if provided)
      const pattern = source
        ? (source.endsWith('.md') ? source : `${source.replace(/\/$/, '')}/**/*.md`)
        : '**/*.md';
      const files = globSync(pattern, { cwd: wikiDir });
      const pages: Array<{ path: string; raw: string }> = [];
      for (const file of files) {
        const raw = await readFile(join(wikiDir, file), 'utf-8');
        pages.push({ path: file, raw });
      }

      // Find unresolved links
      const unresolved = findUnresolvedLinks(pages);
      if (unresolved.length === 0) {
        console.log('No unresolved links found. Wiki is complete!');
        break;
      }

      console.log(`Found ${unresolved.length} unresolved links:`);
      unresolved.forEach(l => console.log(`  - ${l}`));

      if (opts.dryRun) {
        console.log('\n(dry run — skipping ingestion)');
        continue;
      }

      console.log();

      let ingested = 0;
      for (let i = 0; i < unresolved.length; i++) {
        const linkTitle = unresolved[i];
        const wikiTitle = linkTitle.replace(/\s+/g, '_');
        console.log(`[${i + 1}/${unresolved.length}] ${linkTitle}`);

        try {
          // Check if wiki page already exists
          const slug = linkTitle.toLowerCase().replace(/\s+/g, '-');
          const existingCategories = ['persons', 'events', 'eras', 'places', 'concepts'];
          let alreadyExists = false;
          for (const cat of existingCategories) {
            const existing = await wiki.loadPage(cat, slug);
            if (existing) {
              console.log(`  -> Wiki: already exists (${cat}/${slug}.md), skipping`);
              alreadyExists = true;
              break;
            }
          }
          if (alreadyExists) continue;

          // Fetch from Wikipedia
          if (await rawStore.exists('discovered', wikiTitle)) {
            console.log('  -> Raw: cached');
          } else {
            console.log('  -> Fetching from vi.wikipedia.org...');
            const article = await fetchArticle(wikiTitle);
            await rawStore.save('discovered', article);
            console.log('  -> Raw: saved');
          }

          // Load raw content
          const raw = await rawStore.load('discovered', wikiTitle);
          if (!raw) throw new Error('Failed to load raw article');

          // Ingest with LLM (auto-classify type/era)
          console.log(`  -> Compiling with ${provider}...`);
          const wikiPage = await ingestDiscoveredArticle(client, wikiTitle, raw.content, model);

          // Parse the generated page to determine category
          const parsed = parseWikiPage(wikiPage);
          const type = parsed.frontmatter.type || 'concept';
          const category = type === 'dynasty' ? 'eras' : `${type}s`;

          await wiki.savePage(category, slug, wikiPage);
          console.log(`  -> Wiki: saved -> wiki/${category}/${slug}.md (${type}, ${parsed.frontmatter.era})`);
          ingested++;
        } catch (err) {
          console.error(`  -> Error: ${err instanceof Error ? err.message : err}`);
        }

        console.log();
      }

      console.log(`Round ${round} complete: ${ingested}/${unresolved.length} articles ingested.`);
    }

    console.log('\nDone! Run `vn-wiki build-graph` to update the visualization.');
  });

program.parse();
