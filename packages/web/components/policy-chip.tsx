interface PolicyChipProps {
  policy: 'AUTO_EXECUTE' | 'REQUEST_APPROVAL' | 'RECOMMEND_ONLY' | 'REFUSE';
}

export function PolicyChip({ policy }: PolicyChipProps) {
  const map: Record<PolicyChipProps['policy'], string> = {
    AUTO_EXECUTE: 'bg-cyan-500/20 text-cyan-200',
    REQUEST_APPROVAL: 'bg-violet-500/20 text-violet-200',
    RECOMMEND_ONLY: 'bg-amber-500/20 text-amber-300',
    REFUSE: 'bg-rose-500/20 text-rose-300',
  };

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${map[policy]}`}>
      {policy.replace('_', ' ')}
    </span>
  );
}
