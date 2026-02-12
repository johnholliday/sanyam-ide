/**
 * Unit tests for MockSupabaseClient
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockSupabaseClient,
  createMockSupabaseClientOffline,
  type MockSupabaseClient,
} from '../../../src/mocks/supabase-client.js';

describe('MockSupabaseClient', () => {
  let client: MockSupabaseClient;

  beforeEach(() => {
    client = createMockSupabaseClient({
      data: {
        documents: [
          { id: '1', name: 'Doc 1', user_id: 'user-1' },
          { id: '2', name: 'Doc 2', user_id: 'user-1' },
          { id: '3', name: 'Doc 3', user_id: 'user-2' },
        ],
      },
    });
  });

  describe('select operations', () => {
    it('should return all rows when no filters applied', async () => {
      const { data, error } = await client.from('documents').select('*');

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
    });

    it('should filter with eq()', async () => {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('user_id', 'user-1');

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
      expect((data as Array<{ user_id: string }>).every((d) => d.user_id === 'user-1')).toBe(
        true
      );
    });

    it('should filter with neq()', async () => {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .neq('user_id', 'user-1');

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect((data as Array<{ user_id: string }>)[0]?.user_id).toBe('user-2');
    });

    it('should filter with in()', async () => {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .in('id', ['1', '3']);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('should apply limit()', async () => {
      const { data, error } = await client.from('documents').select('*').limit(2);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('should apply range()', async () => {
      const { data, error } = await client.from('documents').select('*').range(1, 2);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('should return single row with single()', async () => {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('id', '1')
        .single();

      expect(error).toBeNull();
      expect((data as { id: string }).id).toBe('1');
    });

    it('should error on single() with multiple rows', async () => {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('user_id', 'user-1')
        .single();

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('PGRST116');
    });

    it('should error on single() with no rows', async () => {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('id', 'nonexistent')
        .single();

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('PGRST116');
    });

    it('should return null with maybeSingle() when no rows', async () => {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('id', 'nonexistent')
        .maybeSingle();

      expect(data).toBeNull();
      expect(error).toBeNull();
    });

    it('should return empty array for non-existent table', async () => {
      const { data, error } = await client.from('nonexistent').select('*');

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('should order results', async () => {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .order('name', { ascending: false });

      expect(error).toBeNull();
      const names = (data as Array<{ name: string }>).map((d) => d.name);
      expect(names).toEqual(['Doc 3', 'Doc 2', 'Doc 1']);
    });
  });

  describe('insert operations', () => {
    it('should insert a single row', async () => {
      const { data, error } = await client.from('documents').insert({
        name: 'New Doc',
        user_id: 'user-3',
      });

      expect(error).toBeNull();
      expect((data as { name: string }).name).toBe('New Doc');
      expect((data as { id: string }).id).toBeDefined();

      // Verify it's in the store
      const { data: all } = await client.from('documents').select('*');
      expect(all).toHaveLength(4);
    });

    it('should insert multiple rows', async () => {
      const { data, error } = await client.from('documents').insert([
        { name: 'New Doc 1', user_id: 'user-3' },
        { name: 'New Doc 2', user_id: 'user-3' },
      ]);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('should auto-generate id if not provided', async () => {
      const { data } = await client.from('documents').insert({
        name: 'Auto ID Doc',
        user_id: 'user-3',
      });

      expect((data as { id: string }).id).toBeDefined();
      expect(typeof (data as { id: string }).id).toBe('string');
    });

    it('should preserve provided id', async () => {
      const { data } = await client.from('documents').insert({
        id: 'custom-id',
        name: 'Custom ID Doc',
        user_id: 'user-3',
      });

      expect((data as { id: string }).id).toBe('custom-id');
    });
  });

  describe('update operations', () => {
    it('should update matching rows', async () => {
      const { data, error } = await client
        .from('documents')
        .update({ name: 'Updated Name' })
        .eq('id', '1');

      expect(error).toBeNull();
      expect((data as Array<{ name: string }>)[0]?.name).toBe('Updated Name');

      // Verify update persisted
      const { data: doc } = await client
        .from('documents')
        .select('*')
        .eq('id', '1')
        .single();
      expect((doc as { name: string }).name).toBe('Updated Name');
    });

    it('should return empty array when no rows match', async () => {
      const { data, error } = await client
        .from('documents')
        .update({ name: 'Updated' })
        .eq('id', 'nonexistent');

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe('delete operations', () => {
    it('should delete matching rows', async () => {
      const { data, error } = await client.from('documents').delete().eq('id', '1');

      expect(error).toBeNull();
      expect((data as { count: number }).count).toBe(1);

      // Verify deletion
      const { data: all } = await client.from('documents').select('*');
      expect(all).toHaveLength(2);
    });
  });

  describe('upsert operations', () => {
    it('should insert new row', async () => {
      const { data, error } = await client.from('documents').upsert({
        id: 'new-id',
        name: 'New Doc',
        user_id: 'user-3',
      });

      expect(error).toBeNull();
      expect((data as { id: string }).id).toBe('new-id');
    });

    it('should update existing row', async () => {
      const { data, error } = await client.from('documents').upsert({
        id: '1',
        name: 'Upserted Name',
        user_id: 'user-1',
      });

      expect(error).toBeNull();
      expect((data as { name: string }).name).toBe('Upserted Name');

      // Verify no duplicate created
      const { data: all } = await client.from('documents').select('*');
      expect(all).toHaveLength(3);
    });
  });

  describe('query logging', () => {
    it('should log all queries', async () => {
      await client.from('documents').select('*');
      await client.from('documents').insert({ name: 'New' });
      await client.from('documents').delete().eq('id', '1');

      expect(client.queryLog).toHaveLength(3);
      expect(client.queryLog[0]?.operation).toBe('select');
      expect(client.queryLog[1]?.operation).toBe('insert');
      expect(client.queryLog[2]?.operation).toBe('delete');
    });

    it('should record filters in query log', async () => {
      await client.from('documents').select('*').eq('id', '1').eq('user_id', 'user-1');

      expect(client.queryLog[0]?.filters).toHaveLength(2);
      expect(client.queryLog[0]?.filters[0]).toEqual({
        column: 'id',
        operator: 'eq',
        value: '1',
      });
    });
  });

  describe('reset()', () => {
    it('should restore initial data', async () => {
      // Modify data
      await client.from('documents').delete().eq('id', '1');
      const { data: before } = await client.from('documents').select('*');
      expect(before).toHaveLength(2);

      // Reset
      client.reset();

      // Verify restored
      const { data: after } = await client.from('documents').select('*');
      expect(after).toHaveLength(3);
    });

    it('should clear query log', async () => {
      await client.from('documents').select('*');
      expect(client.queryLog).toHaveLength(1);

      client.reset();

      expect(client.queryLog).toHaveLength(0);
    });
  });

  describe('error injection', () => {
    it('should return injected error for table', async () => {
      const errorClient = createMockSupabaseClient({
        errors: {
          documents: { code: 'PGRST301', message: 'Row not found' },
        },
      });

      const { data, error } = await errorClient.from('documents').select('*');

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe('PGRST301');
      expect(error?.message).toBe('Row not found');
    });

    it('should not affect other tables', async () => {
      const errorClient = createMockSupabaseClient({
        data: {
          users: [{ id: '1', name: 'User 1' }],
        },
        errors: {
          documents: { code: 'ERROR', message: 'Error' },
        },
      });

      const { data, error } = await errorClient.from('users').select('*');

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });
});

describe('createMockSupabaseClientOffline', () => {
  it('should return network error for all operations', async () => {
    const offlineClient = createMockSupabaseClientOffline();

    const { data, error } = await offlineClient.from('documents').select('*');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe('NETWORK_ERROR');
    expect(error?.message).toContain('Network error');
  });

  it('should return network error for any table', async () => {
    const offlineClient = createMockSupabaseClientOffline();

    const { error: error1 } = await offlineClient.from('documents').select('*');
    const { error: error2 } = await offlineClient.from('users').select('*');
    const { error: error3 } = await offlineClient.from('anything').select('*');

    expect(error1?.code).toBe('NETWORK_ERROR');
    expect(error2?.code).toBe('NETWORK_ERROR');
    expect(error3?.code).toBe('NETWORK_ERROR');
  });
});
