'use client';

import { FC } from 'react';
import { Snapshot } from '@/types/snapshot.ts';
import { formatLamportsToSol } from '@/app/utils.ts';
import { Paginator } from '@/app/components/ui/Paginator.tsx';
import { useIsMobile } from '@/app/hooks';
import { useTheme } from '@/app/components/theme/theme-provider.tsx';
import {
  Avatar,
  Button,
  Icon,
  IconButton,
  Surface,
  Text,
  TextField,
  Tooltip,
  Table,
} from '@/app/components/ui';

type ValidatorsInfo = {
  totalValidators: number;
  currentPage: number;
  pubKeyFilter: string;
  snapshot: Snapshot | null;
  setCurrentPageAction: (page: number) => void;
  setPubKeyFilterAction: (key: string) => void;
  onValidatorMonitorAction: (pubKey: string) => void;
};
export const ValidatorsInfo: FC<ValidatorsInfo> = ({
  snapshot,
  totalValidators,
  currentPage,
  setCurrentPageAction,
  setPubKeyFilterAction,
  onValidatorMonitorAction,
}) => {
  const { colors } = useTheme();
  const isMobile = useIsMobile();

  type ValidatorTableColumn = {
    identity: string;
    identityPubKey: string;
    stake: string;
    commission: string;
    icon?: string | undefined;
    ranking?: string;
    isDelinquent: boolean;
  };

  const deskTopColumnsDefinition = [
    {
      label: 'Rank',
      align: 'start',
      prop: 'ranking',
      width: '7%',
    },
    {
      label: 'Identity',
      align: 'start',
      prop: 'identity',
      width: '35%',
      render: (row: ValidatorTableColumn) => {
        return (
          <div className="w-full flex gap-15 items-center">
            {row.icon && (
              <img
                alt={row.identityPubKey}
                src={row.icon}
                width={'32px'}
                style={{ borderRadius: 9999 }}
              />
            )}
            {!row.icon && <Avatar name={row.identity} size={'32px'} />}
            {row.isDelinquent && (
              <Tooltip
                content={'Delinquent'}
                backgroundColor={colors.background['04']}
              >
                <Icon
                  name={'exclamationMark'}
                  size={'16px'}
                  color={colors.secondary.yellowMedium}
                />
              </Tooltip>
            )}
            <Text content={row.identity} />
          </div>
        );
      },
    },
    {
      label: 'Stake',
      align: 'center',
      prop: 'stake',
      width: '15%',
    },
    {
      label: 'Commission',
      align: 'center',
      prop: 'commission',
      width: '15%',
    },
    {
      label: 'Last vote',
      align: 'center',
      prop: 'lastVote',
      width: '15%',
    },
    {
      label: 'Earned credits',
      align: 'center',
      prop: 'earnedCredits',
      width: '15%',
    },
    {
      label: 'Version',
      align: 'center',
      prop: 'version',
      width: '15%',
    },
    {
      label: 'Skip rate',
      align: 'center',
      prop: 'skipRate',
      width: '15%',
    },
    {
      label: '',
      align: 'end',
      prop: '-',
      width: '5%',
      sortable: false,
      render: (row: ValidatorTableColumn) => {
        return (
          <Tooltip
            content={'Start monitoring'}
            backgroundColor={colors.background['04']}
          >
            <IconButton
              icon={'start'}
              buttonColor={colors.primary['02']}
              iconSize={'18px'}
              onClick={() => onValidatorMonitorAction(row.identityPubKey)}
            />
          </Tooltip>
        );
      },
    },
  ];

  const mobileColumsDefinition = [
    {
      label: '',
      align: 'start',
      prop: 'identity',
      width: '35%',
      render: (row: ValidatorTableColumn) => {
        return (
          <div className="w-full flex gap-5 items-center">
            {row.icon && (
              <img
                alt={row.identityPubKey}
                src={row.icon}
                width={'20px'}
                style={{ borderRadius: 9999 }}
              />
            )}
            {!row.icon && <Avatar name={row.identity} size={'20px'} />}
            {row.isDelinquent && (
              <Tooltip
                content={'Delinquent'}
                backgroundColor={colors.background['04']}
              >
                <Icon
                  name={'exclamationMark'}
                  size={'16px'}
                  color={colors.secondary.yellowMedium}
                />
              </Tooltip>
            )}
            <Text weight={700} content={row.identity} />
          </div>
        );
      },
    },
    {
      label: 'Rank',
      align: 'start',
      prop: 'ranking',
      width: '7%',
    },
    {
      label: 'Stake',
      align: 'center',
      prop: 'stake',
      width: '15%',
    },
    {
      label: 'Last vote',
      align: 'center',
      prop: 'lastVote',
      width: '15%',
    },
    {
      label: 'Earned credits',
      align: 'center',
      prop: 'earnedCredits',
      width: '15%',
    },
    {
      label: '',
      align: 'end',
      prop: '-',
      width: '5%',
      sortable: false,
      render: (row: ValidatorTableColumn) => {
        return (
          <Tooltip
            content={'Start monitoring'}
            backgroundColor={colors.background['04']}
          >
            {!isMobile && (
              <IconButton
                icon={'start'}
                buttonColor={colors.primary['02']}
                iconSize={'18px'}
                onClick={() => onValidatorMonitorAction(row.identityPubKey)}
              />
            )}
            {isMobile && (
              <Button
                reduced
                label={'Start session'}
                onClick={() => onValidatorMonitorAction(row.identityPubKey)}
              />
            )}
          </Tooltip>
        );
      },
    },
  ];

  const columns = snapshot
    ? snapshot.validators.map((v) => {
        const maxChars = isMobile ? 15 : 20;
        let identity = (v.info?.info.name ?? v.identityPubkey).slice(
          0,
          maxChars
        );
        if ((v.info?.info.name ?? v.identityPubkey).length > maxChars) {
          identity = identity.concat('...');
        }

        if (identity === '') {
          identity = 'Unnamed';
        }

        const icon = v.info?.info?.iconUrl;

        return {
          version: v.version,
          identity: identity,
          identityPubKey: v.identityPubkey,
          stake: formatLamportsToSol(v.activatedStake),
          commission: `${v.commission}%`,
          lastVote: v.lastVote,
          earnedCredits: v.epochCredits,
          skipRate: `${Number.isInteger(v.skipRate ?? 0) ? (v.skipRate ?? 0) : (v.skipRate ?? 0).toFixed(2)}%`,
          icon,
          ranking: v.ranking ? `#${v.ranking}` : '-',
          isDelinquent: v.delinquent,
        };
      })
    : [];

  return (
    <Surface
      width={'100%'}
      padding={'20px 30px'}
      border={true}
      borderColor={colors.background['03']}
      opacity={0.75}
    >
      <div className={'w-full flex-col gap-15 items-center content-center'}>
        <div className="w-full">
          <TextField
            placeholder={'Filter validator identity'}
            updateModel={setPubKeyFilterAction}
          />
        </div>
        <Table
          itemsPerPage={15}
          columns={
            (isMobile
              ? mobileColumsDefinition
              : deskTopColumnsDefinition) as unknown as never
          }
          data={columns}
          mobile={{
            useCards: true,
            spacingBetweenCols: '12px',
            spacingBetweenRows: '10px',
            cardBg: colors.background['03'],
          }}
        />
        <Paginator
          elements={totalValidators}
          itemsPerPage={10}
          page={currentPage}
          onPageChange={setCurrentPageAction}
        />
      </div>
    </Surface>
  );
};
