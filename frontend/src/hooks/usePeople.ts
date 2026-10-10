// people router: persons, vehicles and other objects, and locations.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CaseObject,
  CaseObjectCreate,
  CaseObjectUpdate,
  Id,
  Location,
  LocationCreate,
  LocationUpdate,
  Person,
  PersonCreate,
  PersonUpdate
} from '@/types/api';
import { invalidateCase, queryKeys } from './queryKeys';

// The three resources share one shape: GET/POST under the case, PATCH/DELETE by id.
const makeResourceHooks = <T extends { id: Id; case_id: Id }, TCreate, TUpdate>(
  collection: 'persons' | 'objects' | 'locations',
  key: (caseId: Id) => readonly unknown[]
) => ({
  useList: (caseId: Id | undefined) =>
    useQuery({
      queryKey: key(caseId!),
      queryFn: ({ signal }) => api.get<T[]>(`/cases/${caseId}/${collection}`, undefined, signal),
      enabled: caseId !== undefined
    }),
  useCreate: (caseId: Id) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (input: TCreate) => api.post<T>(`/cases/${caseId}/${collection}`, input),
      onSuccess: () => invalidateCase(queryClient, caseId)
    });
  },
  useUpdate: (caseId: Id) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ id, input }: { id: Id; input: TUpdate }) => api.patch<T>(`/${collection}/${id}`, input),
      onSuccess: () => invalidateCase(queryClient, caseId)
    });
  },
  useDelete: (caseId: Id) => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (id: Id) => api.delete(`/${collection}/${id}`),
      onSuccess: () => invalidateCase(queryClient, caseId)
    });
  }
});

const persons = makeResourceHooks<Person, PersonCreate, PersonUpdate>('persons', queryKeys.persons);
const objects = makeResourceHooks<CaseObject, CaseObjectCreate, CaseObjectUpdate>('objects', queryKeys.objects);
const locations = makeResourceHooks<Location, LocationCreate, LocationUpdate>('locations', queryKeys.locations);

export const usePersons = persons.useList;
export const useCreatePerson = persons.useCreate;
export const useUpdatePerson = persons.useUpdate;
export const useDeletePerson = persons.useDelete;

export const useObjects = objects.useList;
export const useCreateObject = objects.useCreate;
export const useUpdateObject = objects.useUpdate;
export const useDeleteObject = objects.useDelete;

export const useLocations = locations.useList;
export const useCreateLocation = locations.useCreate;
export const useUpdateLocation = locations.useUpdate;
export const useDeleteLocation = locations.useDelete;
