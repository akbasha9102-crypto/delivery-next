import { notFound } from 'next/navigation';
import { FEATURE_SLUGS, FEATURE_CONTENT, type FeatureSlug } from '@/app/home/featureContent';
import FeaturePageClient from './FeaturePageClient';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return FEATURE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const content = FEATURE_CONTENT[slug as FeatureSlug];
  if (!content) return {};
  return {
    title: `${content.label} — ماشي`,
    description: content.tagline,
  };
}

export default async function FeaturePage({ params }: Props) {
  const { slug } = await params;
  const content = FEATURE_CONTENT[slug as FeatureSlug];
  if (!content) notFound();
  return <FeaturePageClient slug={slug as FeatureSlug} />;
}
