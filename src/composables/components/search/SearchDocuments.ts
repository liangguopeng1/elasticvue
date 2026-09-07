import { useElasticsearchAdapter } from '../../CallElasticsearch'
import { useSearchStore } from '../../../store/search'
import { useResizeStore } from '../../../store/resize'
import { computed, Ref, ref, watch } from 'vue'
import { parseJson } from '../../../helpers/json/parse'
import { DEFAULT_SEARCH_QUERY_OBJ, MAX_SEARCH_RESULT_WINDOW } from '../../../consts'
import { stringifyJson } from '../../../helpers/json/stringify.ts'
import {
  buildQueryFromTableOptions,
  getTableOptionsToApply
} from '../../../helpers/search/searchQueryTableOptions'
import { paginationFromQuery } from '../../../helpers/search/paginationFromQuery'

export type EsSearchResult = {
  took: number | null
  hits: EsSearchResultHits
  aggregations?: Record<string, any>
}

type EsSearchResultHits = {
  total: EsSearchResultsHitsValues | number
  hits?: any
}

type EsSearchResultsHitsValues = {
  value: number
}

const hitsTotalValue = (total: EsSearchResultHits['total'] | undefined): number => {
  if (typeof total === 'number') return total
  return total?.value ?? 0
}

const clampSearchWindow = (query: Record<string, unknown>) => {
  if (query.track_total_hits === undefined) query.track_total_hits = true
  let size = typeof query.size === 'number' && query.size > 0 ? query.size : 10
  let from = typeof query.from === 'number' && query.from >= 0 ? query.from : 0
  if (size > MAX_SEARCH_RESULT_WINDOW) size = MAX_SEARCH_RESULT_WINDOW
  if (from + size > MAX_SEARCH_RESULT_WINDOW) from = Math.max(0, MAX_SEARCH_RESULT_WINDOW - size)
  query.size = size
  query.from = from
}

export const useSearchDocuments = () => {
  const { requestState, callElasticsearch } = useElasticsearchAdapter()

  const searchStore = useSearchStore()
  const resizeStore = useResizeStore()

  const searchResults: Ref<EsSearchResult> = ref({ took: null, hits: { total: { value: 0 } } })
  const queryParsingError = ref(false)
  const search = async () => {
    let query
    try {
      queryParsingError.value = false
      query = parseJson(searchStore.searchQuery)
    } catch (_e) {
      queryParsingError.value = true
      return
    }

    clampSearchWindow(query as Record<string, unknown>)
    const pag = paginationFromQuery(query as Record<string, unknown>, searchStore.pagination.rowsPerPage)
    searchStore.pagination.page = pag.page
    searchStore.pagination.rowsPerPage = pag.rowsPerPage

    try {
      searchResults.value = await callElasticsearch('search', query, searchStore.indices)
      const actualTotal = hitsTotalValue(searchResults.value.hits?.total)
      searchStore.pagination.rowsNumber = Math.min(actualTotal, MAX_SEARCH_RESULT_WINDOW)
    } catch (e) {
      console.error(e)
      searchResults.value = { took: null, hits: { total: { value: 0 } } }
    }
  }

  watch(
    () => searchStore.indices,
    () => {
      searchStore.pagination.sortBy = ''
      try {
        mergeQuery(Object.assign({}, parseJson(searchStore.searchQuery), { sort: [] }))
      } catch (e) {
        console.error(e)
      }
    }
  )

  watch(
    () => searchStore.q,
    (value) => {
      mergeQuery({ query: { query_string: { query: value } } })
    }
  )

  // pagination = {sortBy: '', descending: false, page: 2, rowsPerPage: 10, rowsNumber: 2593}
  const onRequest = ({ pagination }: any) => {
    const query = parseJson(searchStore.searchQuery) as Record<string, unknown>
    const tableOptions = buildQueryFromTableOptions(pagination)
    const sortByChanged = pagination.sortBy !== searchStore.pagination.sortBy
    const toApply =
      sortByChanged ? tableOptions : getTableOptionsToApply(query, tableOptions, pagination)
    Object.assign(query, toApply)

    searchStore.pagination.page = pagination.page
    if ('sort' in toApply) {
      searchStore.pagination.sortBy = pagination.sortBy
      searchStore.pagination.descending = pagination.descending
    } else {
      searchStore.pagination.sortBy = ''
      searchStore.pagination.descending = false
    }

    searchStore.searchQuery = stringifyJson(query)
    search()
  }

  const mergeQuery = (params: any) => {
    const json = Object.assign({}, DEFAULT_SEARCH_QUERY_OBJ, params)
    searchStore.searchQuery = stringifyJson(json, null, '\t')
  }

  const editorCommands = [
    {
      key: 'Ctrl-Enter',
      run: () => {
        search()
        return true
      }
    },
    {
      key: 'Cmd-Enter',
      run: () => {
        search()
        return true
      }
    }
  ]

  const hitsTotal = computed(() => hitsTotalValue(searchResults.value.hits?.total))

  return {
    search,
    searchResults,
    hitsTotal,
    searchStore,
    resizeStore,
    queryParsingError,
    requestState,
    editorCommands,
    onRequest
  }
}

export { buildQueryFromTableOptions, getTableOptionsToApply } from '../../../helpers/search/searchQueryTableOptions'
