'use client';

import { FC } from 'react';
import { formatLamportsToSol } from '@/app/utils.ts';
import { Snapshot, VersionData } from '@/types/snapshot.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import { clientLabel } from '@/app/client-label.ts';
import {
  Avatar,
  Divider,
  ExternalLink,
  Icon,
  Surface,
  Text,
  Tooltip,
} from '@/app/components/ui';

// Shown for what is not known: an unknown vote account, or no snapshot yet.
const UNKNOWN = '—';

type ValidatorInfoProps = {
  vote: string;
  snapshot: Snapshot | null;
  version: VersionData | undefined;
};

export const ValidatorInfo: FC<ValidatorInfoProps> = ({
  vote,
  snapshot,
  version,
}) => {
  const { colors } = useTheme();

  // The monitor follows the vote account: an identity switch keeps it.
  const validator = snapshot?.validators.find(
    (v) => v.voteAccountPubkey === vote
  );
  const validatorIdentity = validator?.identityPubkey ?? '';
  const validatorName = validator?.info?.info.name ?? validatorIdentity;
  const validatorVoteAccount = validator?.voteAccountPubkey ?? vote;
  const validatorVersion = validator?.version ?? UNKNOWN;
  const validatorClient = clientLabel(validator?.client);
  const validatorCommission = validator ? `${validator.commission}%` : UNKNOWN;
  const validatorDelinquent = validator
    ? validator.delinquent
      ? 'Yes'
      : 'No'
    : UNKNOWN;
  const validatorStake = validator
    ? formatLamportsToSol(validator.activatedStake)
    : UNKNOWN;
  const validatorIcon = validator?.info?.info.iconUrl ?? '';

  const onCopy = async (hash: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(hash);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={'flex w-full'}>
      <Surface
        width={'100%'}
        padding={'20px 30px'}
        border={true}
        borderColor={colors.background['03']}
        opacity={0.75}
      >
        <div className={'w-full flex-col gap-30'}>
          <div className={'w-full flex gap-15 items-center'}>
            {validatorIcon && (
              <img
                src={validatorIcon}
                alt={validatorIdentity}
                width={'40px'}
                style={{ borderRadius: 9999 }}
              />
            )}
            {!validatorIcon && <Avatar name={validatorName} size={'40px'} />}
            {validatorName && (
              <Text weight={700} variant={'h3'} content={validatorName} />
            )}
          </div>
          <Divider color={colors.background['01']} />
          <div className={'w-full flex-col gap-10'}>
            <div className={'w-full flex gap-5 items-center'}>
              <Text content={'Identity: '} />
              {validatorIdentity ? (
                <>
                  <ExternalLink
                    textVariant={'littleBody'}
                    label={validatorIdentity}
                    to={`https://www.validators.app/validators/${validatorIdentity}?locale=en&network=mainnet`}
                  />
                  <Icon
                    name={'copy'}
                    size={'16px'}
                    clickable
                    onClick={() => onCopy(validatorIdentity)}
                  />
                </>
              ) : (
                <Text variant={'littleBody'} content={UNKNOWN} />
              )}
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text content={'Vote account: '} />
              <Text
                variant={'littleBody'}
                content={`${validatorVoteAccount.slice(0, validatorVoteAccount.length - 10)}...`}
              />
              <Icon
                name={'copy'}
                size={'16px'}
                clickable
                onClick={() => onCopy(validatorVoteAccount)}
              />
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text
                content={`Stake: <b>${validatorStake}</b>`}
              />
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text
                content={`Version: <b>${validatorVersion}</b>${validatorClient ? ` (${validatorClient})` : ''}`}
              />
              <Tooltip
                content={`This version is used by:
 - ${version?.currentValidatorsPercent?.toFixed(2)}% of the validators\n - ${version?.stakePercent.toFixed(2)}% of the stake\n- Has ${version?.delinquentPercent}% of delinquent`}
                backgroundColor={colors.background['04']}
              >
                <Icon name={'help'} size={'20px'} />
              </Tooltip>
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text content={`Commission: <b>${validatorCommission}</b>`} />
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text
                content={`Delinquent: <b>${validatorDelinquent}</b>`}
              />
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
};
