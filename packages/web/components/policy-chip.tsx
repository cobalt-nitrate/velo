interface PolicyChipProps {
  policy: 'AUTO_EXECUTE' | 'REQUEST_APPROVAL' | 'RECOMMEND_ONLY' | 'REFUSE';
}

export function PolicyChip({ policy }: PolicyChipProps) {
  const map: Record<PolicyChipProps['policy'], string> = {
    AUTO_EXECUTE: 'bg-teal-50 text-teal-900 ring-1 ring-teal-200/90',
    REQUEST_APPROVAL: 'bg-violet-50 text-violet-950 ring-1 ring-violet-200/90',
    RECOMMEND_ONLY: 'bg-amber-50 text-amber-950 ring-1 ring-amber-200/90',
    REFUSE: 'bg-rose-50 text-rose-900 ring-1 ring-rose-200/90',
  };

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${map[policy]}`}>
      {policy.replace('_', ' ')}
    </span>
  );
}
