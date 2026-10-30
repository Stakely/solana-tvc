'use client';

import { FC, useEffect, useState } from 'react';
import { GetSnapshotResponse } from '@/types/snapshot.ts';
import { getJson } from '@/app/get-json.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { Surface, Text } from '@/app/components/ui';
import {
  HOW_WE_MEASURE_TITLE,
  PageBlock,
  howWeMeasureSections,
} from '@/app/components/measure-texts.ts';

// The "Not measurable" stake comes from the current budget and stake (spec
// §6.6), so the page reads it once.
async function fetchMinMeasurableStake(): Promise<string | null> {
  const body = await getJson<GetSnapshotResponse>('/api/snapshot?size=1');
  return body?.minMeasurableStake ?? null;
}

// globals.css resets list styles, so lists get theirs here.
const Block: FC<{ block: PageBlock; color: string }> = ({ block, color }) => {
  if (block.kind === 'p') {
    return (
      <p>
        <Text content={block.text} />
      </p>
    );
  }
  const style = {
    paddingLeft: '24px',
    listStyle: block.kind === 'ul' ? 'disc' : 'decimal',
    color,
  };
  const items = block.items.map((item, index) => (
    <li key={index} style={{ marginBottom: '8px' }}>
      <Text content={item} />
    </li>
  ));
  return block.kind === 'ul' ? (
    <ul style={style}>{items}</ul>
  ) : (
    <ol style={style}>{items}</ol>
  );
};

export const HowWeMeasure: FC = () => {
  const { colors } = useTheme();
  const [minMeasurableStake, setMinMeasurableStake] = useState<string | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    fetchMinMeasurableStake().then((value) => {
      if (!cancelled) setMinMeasurableStake(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={'w-full flex-col gap-20 p-b-20'}>
      <Surface
        width={'100%'}
        padding={'30px'}
        border={true}
        borderColor={colors.background['03']}
        opacity={0.75}
      >
        <article
          className={'w-full flex-col gap-20'}
          style={{ maxWidth: '820px' }}
        >
          <h1>
            <Text variant={'h2'} content={HOW_WE_MEASURE_TITLE} />
          </h1>
          {howWeMeasureSections(minMeasurableStake).map((section, index) => (
            <section key={index} className={'w-full flex-col gap-10'}>
              {section.heading && (
                <h2>
                  <Text variant={'h3'} content={section.heading} />
                </h2>
              )}
              {section.blocks.map((block, blockIndex) => (
                <Block
                  key={blockIndex}
                  block={block}
                  color={colors.background['00']}
                />
              ))}
            </section>
          ))}
        </article>
      </Surface>
    </div>
  );
};
