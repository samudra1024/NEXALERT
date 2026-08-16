import { useCallback, useEffect, useRef, useState } from 'react';
import ContactStore, { CONTACT_PAGE_SIZE } from '../services/ContactStore';

function contactKey(contact) {
  return contact?.normalizedPhone || contact?.contactId || contact?.id || '';
}

function appendUniqueContacts(existing, incoming) {
  if (!incoming.length) {
    return existing;
  }

  const seen = new Set(existing.map(contactKey).filter(Boolean));
  const uniqueIncoming = incoming.filter(contact => {
    const key = contactKey(contact);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  console.log('[CONTACT APPEND]', {
    before: existing.length,
    received: incoming.length,
    after: existing.length + uniqueIncoming.length,
  });

  return [...existing, ...uniqueIncoming];
}

export default function useContacts(options = {}) {
  const {
    includeConversations = true,
    autoLoad = true,
    pageSize = CONTACT_PAGE_SIZE,
  } = options;

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(autoLoad);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const loadingRef = useRef(false);
  const searchRef = useRef('');
  const searchDebounceRef = useRef(null);
  const searchGenerationRef = useRef(0);
  const loadGenerationRef = useRef(0);
  const initialLoadDoneRef = useRef(false);
  const pendingRefreshRef = useRef(null);
  const refreshRef = useRef(null);

  const applyPaginationMeta = useCallback((meta) => {
    setTotal(meta.total);
    setHasMore(meta.hasMore);
    hasMoreRef.current = meta.hasMore;
    setPage(meta.page);
    pageRef.current = meta.page;
  }, []);

  const applyResult = useCallback((result, append = false) => {
    setContacts(prev => (append ? appendUniqueContacts(prev, result.contacts) : result.contacts));
    applyPaginationMeta({
      page: result.page,
      total: result.total,
      hasMore: result.hasMore,
    });
    setFromCache(result.fromCache);
  }, [applyPaginationMeta]);

  const loadPage = useCallback(async (nextPage, query, append = false) => {
    const trimmed = (query || '').trim();
    const generation = ++loadGenerationRef.current;

    if (append) {
      if (loadingMoreRef.current || !hasMoreRef.current) {
        return;
      }
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      if (loadingRef.current) {
        return;
      }
      loadingRef.current = true;
      if (!initialLoadDoneRef.current) {
        setLoading(true);
      }
    }

    try {
      const result = await ContactStore.loadContacts({
        page: nextPage,
        pageSize,
        searchQuery: trimmed,
        includeConversations: includeConversations && nextPage === 1 && !trimmed,
        backgroundSync: nextPage === 1 && !trimmed,
        onSyncComplete: meta => {
          if (generation !== loadGenerationRef.current) {
            return;
          }
          if (pageRef.current !== nextPage) {
            return;
          }
          console.log('[CONTACT PAGINATION] post-sync hasMore update', meta);
          applyPaginationMeta(meta);
        },
      });

      if (generation !== loadGenerationRef.current) {
        return;
      }

      applyResult(result, append);
      ContactStore.prefetchImages(result.contacts);
      initialLoadDoneRef.current = true;
      setPermissionDenied(false);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      if (error?.message?.includes('permission')) {
        setPermissionDenied(true);
      }
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
        loadingRef.current = false;

        if (pendingRefreshRef.current !== null) {
          const pendingForceSync = pendingRefreshRef.current;
          pendingRefreshRef.current = null;
          refreshRef.current?.(pendingForceSync).catch(() => {});
        }
      }
    }
  }, [applyPaginationMeta, applyResult, includeConversations, pageSize]);

  const refresh = useCallback(async (forceSync = true) => {
    if (loadingMoreRef.current || loadingRef.current) {
      pendingRefreshRef.current = forceSync;
      return;
    }

    setSyncing(true);
    try {
      pageRef.current = 1;
      hasMoreRef.current = true;
      if (forceSync) {
        await ContactStore.syncDeviceContacts(true);
      }
      await loadPage(1, searchRef.current, false);
    } finally {
      setSyncing(false);
    }
  }, [loadPage]);

  refreshRef.current = refresh;

  const loadMore = useCallback(() => {
    if (!hasMoreRef.current || loadingMoreRef.current || loadingRef.current) {
      return;
    }

    const nextPage = pageRef.current + 1;
    console.log('[CONTACT NEXT PAGE]', { requestingPage: nextPage });
    loadPage(nextPage, searchRef.current, true);
  }, [loadPage]);

  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);
    searchRef.current = text;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const generation = ++searchGenerationRef.current;
    searchDebounceRef.current = setTimeout(async () => {
      pageRef.current = 1;
      hasMoreRef.current = true;
      loadGenerationRef.current += 1;
      setLoading(true);
      loadingRef.current = true;
      try {
        const result = await ContactStore.loadContacts({
          page: 1,
          pageSize,
          searchQuery: text.trim(),
          includeConversations: false,
          backgroundSync: false,
        });
        if (generation === searchGenerationRef.current) {
          applyResult(result, false);
        }
      } finally {
        if (generation === searchGenerationRef.current) {
          setLoading(false);
          loadingRef.current = false;
        }
      }
    }, 200);
  }, [applyResult, pageSize]);

  const handleEndReached = useCallback(() => {
    console.log('[CONTACT SCROLL]', {
      currentPage: pageRef.current,
      contactsCount: contacts.length,
      hasMore: hasMoreRef.current,
      loadingMore: loadingMoreRef.current,
    });

    if (!hasMoreRef.current || loadingMoreRef.current || loadingRef.current) {
      return;
    }

    loadMore();
  }, [contacts.length, loadMore]);

  useEffect(() => {
    if (!autoLoad) {
      return undefined;
    }

    loadPage(1, '', false);
    const unsubscribe = ContactStore.subscribe(() => {
      if (loadingMoreRef.current) {
        pendingRefreshRef.current = false;
        return;
      }

      if (pageRef.current > 1) {
        ContactStore.syncDeviceContacts(true)
          .then(() => ContactStore.getPaginationMeta(pageRef.current, pageSize, searchRef.current))
          .then(meta => {
            console.log('[CONTACT PAGINATION] observer meta refresh', meta);
            applyPaginationMeta(meta);
          })
          .catch(() => {});
        return;
      }

      refresh(false).catch(() => {});
    });

    return () => {
      unsubscribe();
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [autoLoad, applyPaginationMeta, loadPage, pageSize, refresh]);

  return {
    contacts,
    loading,
    loadingMore,
    syncing,
    hasMore,
    page,
    total,
    fromCache,
    searchQuery,
    permissionDenied,
    setSearchQuery: handleSearchChange,
    refresh,
    loadMore,
    handleEndReached,
  };
}
