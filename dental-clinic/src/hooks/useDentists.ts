import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listDentists } from '@/services/admin';

export function useDentists() {
  return useQuery({ queryKey: ['dentists'], queryFn: listDentists });
}

/**
 * The clinic this is built for has a single dentist, so making the user pick
 * him from a one-item list on every booking is pure friction. Preselect him
 * while the field is still empty; the moment a second dentist exists the list
 * stops auto-filling and the choice comes back.
 */
export function useSoleDentist(
  dentists: { id: string }[] | undefined,
  value: string,
  onPick: (id: string) => void,
) {
  useEffect(() => {
    if (!value && dentists?.length === 1) onPick(dentists[0].id);
    // onPick is a setState function, stable for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dentists, value]);
}
