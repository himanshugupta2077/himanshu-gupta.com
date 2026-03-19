import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const baseSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()),
  draft: z.boolean().optional().default(false),
  featured: z.boolean().optional().default(false),
});

const research = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/research' }),
  schema: baseSchema,
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: baseSchema.extend({
    github: z.string().url().optional(),
    demo: z.string().url().optional(),
  }),
});

const playbooks = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/playbooks' }),
  schema: baseSchema,
});

export const collections = { research, projects, playbooks };
