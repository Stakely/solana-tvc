import type { Metadata } from 'next';
import { HowWeMeasure } from '@/app/how-we-measure/HowWeMeasure.tsx';
import {
  HOW_WE_MEASURE_TITLE,
  SITE_TITLE,
} from '@/app/components/measure-texts.ts';

export const metadata: Metadata = {
  title: `${HOW_WE_MEASURE_TITLE} - ${SITE_TITLE}`,
  description:
    'How votes counted (VIR), statuses and the epoch ratio of Solana validators are measured under Alpenglow.',
};

export default function HowWeMeasurePage() {
  return <HowWeMeasure />;
}
