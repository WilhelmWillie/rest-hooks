import React from 'react';
import { cleanup } from 'react-hooks-testing-library';
import nock from 'nock';

import {
  CoolerArticleResource,
  ArticleResource,
  UserResource,
} from '../../__tests__/common';
import { useResource, useFetcher } from '../hooks';
import makeRenderRestHook from '../../test/makeRenderRestHook';
import {
  makeCacheProvider,
  makeExternalCacheProvider,
} from '../../test/providers';

afterEach(() => {
  cleanup();
});

for (const makeProvider of [makeCacheProvider, makeExternalCacheProvider]) {
  describe(`${makeProvider.name} => <Provider />`, () => {
    const payload = {
      id: 5,
      title: 'hi ho',
      content: 'whatever',
      tags: ['a', 'best', 'react'],
    };
    const users = [
      {
        id: 23,
        username: 'bob',
        email: 'bob@bob.com',
        isAdmin: false,
      },
      {
        id: 7342,
        username: 'lindsey',
        email: 'lindsey@bob.com',
        isAdmin: true,
      },
    ];
    const nested = [
      {
        id: 5,
        title: 'hi ho',
        content: 'whatever',
        tags: ['a', 'best', 'react'],
        author: {
          id: 23,
          username: 'bob',
        },
      },
      {
        id: 3,
        title: 'the next time',
        content: 'whatever',
        author: {
          id: 23,
          username: 'charles',
          email: 'bob@bob.com',
        },
      },
    ];
    // TODO: add nested resource test case that has multiple partials to test merge functionality

    let renderRestHook: ReturnType<typeof makeRenderRestHook>;

    function onError(e: any) {
      e.preventDefault();
    }
    beforeEach(() => {
      window.addEventListener('error', onError);
    });
    afterEach(() => {
      window.removeEventListener('error', onError);
    });

    beforeEach(() => {
      nock('http://test.com')
        .get(`/article-cooler/${payload.id}`)
        .reply(200, payload);
      nock('http://test.com')
        .delete(`/article-cooler/${payload.id}`)
        .reply(204, '');
      nock('http://test.com')
        .delete(`/article/${payload.id}`)
        .reply(200, {});
      nock('http://test.com')
        .get(`/article-cooler/0`)
        .reply(403, {});
      nock('http://test.com')
        .get(`/article-cooler/666`)
        .reply(200, '');
      nock('http://test.com')
        .get(`/article-cooler/`)
        .reply(200, nested);
      nock('http://test.com')
        .get(`/user/`)
        .reply(200, users);
      renderRestHook = makeRenderRestHook(makeProvider);
    });
    afterEach(() => {
      renderRestHook.cleanup();
    });

    it('should resolve useResource()', async () => {
      const { result, waitForNextUpdate } = renderRestHook(() => {
        return useResource(CoolerArticleResource.detailShape(), payload);
      });
      expect(result.current).toBe(null);
      await waitForNextUpdate();
      expect(result.current instanceof CoolerArticleResource).toBe(true);
      expect(result.current.title).toBe(payload.title);
    });

    it('should throw 404 once deleted', async () => {
      let del: any;
      const { result, waitForNextUpdate } = renderRestHook(() => {
        del = useFetcher(CoolerArticleResource.deleteShape());
        return useResource(CoolerArticleResource.detailShape(), payload);
      });
      expect(result.current).toBe(null);
      await waitForNextUpdate();
      expect(result.current instanceof CoolerArticleResource).toBe(true);
      expect(result.current.title).toBe(payload.title);

      await del({}, payload);
      expect(result.error).toBeDefined();
      expect((result.error as any).status).toBe(404);
    });

    it('should throw when retrieving an empty string', async () => {
      const { result, waitForNextUpdate } = renderRestHook(() => {
        return useFetcher(CoolerArticleResource.detailShape());
      });

      await expect(result.current({}, { id: 666 })).rejects.toThrowError(
        'JSON expected but not returned from API',
      );
    });

    it('should not throw on delete', async () => {
      const { result, waitForNextUpdate } = renderRestHook(() => {
        return [
          useFetcher(CoolerArticleResource.deleteShape()),
          useFetcher(ArticleResource.deleteShape()),
        ];
      });

      for (const del of result.current) {
        await expect(del({}, payload)).resolves.toBeDefined();
      }
    });

    it('useResource() should throw errors on bad network', async () => {
      const { result, waitForNextUpdate } = renderRestHook(() => {
        return useResource(CoolerArticleResource.detailShape(), {
          title: '0',
        });
      });
      expect(result.current).toBe(null);
      await waitForNextUpdate();
      expect(result.error).toBeDefined();
      expect((result.error as any).status).toBe(403);
    });

    it('useResource() should throw errors on bad network (multiarg)', async () => {
      const { result, waitForNextUpdate } = renderRestHook(() => {
        return useResource([
          CoolerArticleResource.detailShape(),
          {
            title: '0',
          },
        ]);
      });
      expect(result.current).toBe(null);
      await waitForNextUpdate();
      expect(result.error).toBeDefined();
      expect((result.error as any).status).toBe(403);
    });

    it('should resolve parallel useResource() request', async () => {
      const { result, waitForNextUpdate } = renderRestHook(() => {
        return useResource(
          [
            CoolerArticleResource.detailShape(),
            {
              id: payload.id,
            },
          ],
          [UserResource.listShape(), {}],
        );
      });
      expect(result.current).toBe(null);
      await waitForNextUpdate();
      const [article, users] = result.current;
      expect(article instanceof CoolerArticleResource).toBe(true);
      expect(article.title).toBe(payload.title);
      expect(users).toBeDefined();
      expect(users.length).toBeTruthy();
      expect(users[0] instanceof UserResource).toBe(true);
    });

    it('should not suspend with no params to useResource()', async () => {
      let article: any;
      const { result, waitForNextUpdate } = renderRestHook(() => {
        article = useResource(CoolerArticleResource.detailShape(), null);
        return 'done';
      });
      expect(result.current).toBe('done');
      expect(article).toBeNull();
    });
  });
}
