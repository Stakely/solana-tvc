'use client';

import { FC } from 'react';
import { formatLamportsToSol } from '@/app/utils.ts';
import { Snapshot, VersionData } from '@/types/snapshot.ts';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import {
  Avatar,
  Divider,
  ExternalLink,
  Icon,
  Surface,
  Text,
  Tooltip,
} from '@/app/components/ui';

type ValidatorInfoProps = {
  snapshot: Snapshot | null;
  version: VersionData | undefined;
};
export const ValidatorInfo: FC<ValidatorInfoProps> = ({
  snapshot,
  version,
}) => {
  const { colors } = useTheme();

  const validatorIdentity = snapshot?.validators[0]?.identityPubkey ?? '';
  const validatorName =
    snapshot?.validators[0]?.info?.info.name ?? validatorIdentity;
  const validatorVoteAccount = snapshot?.validators[0]?.voteAccountPubkey ?? '';
  const validatorVersion = snapshot?.validators[0]?.version;
  const validatorCommission = snapshot?.validators[0]?.commission;
  const isValidatorDelinquent = snapshot?.validators[0]?.delinquent;
  const validatorStake = snapshot?.validators[0]?.activatedStake;
  const validatorIcon = snapshot?.validators[0]?.info?.info.iconUrl ?? '';

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
              <Text
                weight={700}
                variant={'h3'}
                content={validatorName ?? validatorIdentity}
              />
            )}
          </div>
          <Divider color={colors.background['01']} />
          <div className={'w-full flex-col gap-10'}>
            <div className={'w-full flex gap-5 items-center'}>
              <Text content={'Identity: '} />
              <ExternalLink
                textVariant={'littleBody'}
                label={`${validatorIdentity}`}
                to={`https://www.validators.app/validators/${validatorIdentity}?locale=en&network=mainnet`}
              />
              <Icon
                name={'copy'}
                size={'16px'}
                clickable
                onClick={() => onCopy(validatorIdentity)}
              />
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
                content={`Stake: <b>${formatLamportsToSol(validatorStake ?? '')}</b>`}
              />
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text content={`Version: <b>${validatorVersion}</b>`} />
              <Tooltip
                content={`This version is used by: 
 - ${version?.currentValidatorsPercent?.toFixed(2)}% of the validators\n - ${version?.stakePercent.toFixed(2)}% of the stake\n- Has ${version?.delinquentPercent}% of delinquent`}
                backgroundColor={colors.background['04']}
              >
                <Icon name={'help'} size={'20px'} />
              </Tooltip>
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text content={`Commission: <b>${validatorCommission}%</b>`} />
            </div>
            <div className={'w-full flex gap-5 items-center'}>
              <Text
                content={`Delinquent: <b>${isValidatorDelinquent ? 'Yes' : 'No'}</b>`}
              />
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
};
