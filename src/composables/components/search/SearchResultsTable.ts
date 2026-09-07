import { computed, Ref, ref, watch } from 'vue'
import { useResizeStore } from '../../../store/resize.js'
import { useSearchStore } from '../../../store/search.ts'
import { useElasticsearchAdapter } from '../../CallElasticsearch.ts'
import { useSelectableRows } from '../../SelectableRow.ts'
import SearchResults from '../../../models/SearchResults.ts'
import { sortableField } from '../../../helpers/search.ts'
import { EsSearchResult } from './SearchDocuments.ts'
import { ElasticsearchDocumentInfo } from './EditDocument.ts'
import { filterItems } from '../../../helpers/filters.ts'
import { stringifyJson } from '../../../helpers/json/stringify.ts'
import { setupFilterState } from '../shared/FilterState.ts'

export type SearchResultsTableProps = {
  results: EsSearchResult
}

export const useSearchResultsTable = (props: SearchResultsTableProps, emit: any) => {
  const resizeStore = useResizeStore()
  const searchStore = useSearchStore()

  const hits: Ref<any[]> = ref([])
  const tableColumns: Ref<any[]> = ref([])
  const activeTab = ref('hits')

  const { callElasticsearch } = useElasticsearchAdapter()

  const { selectedItems, allItemsSelected, setIndeterminate } = useSelectableRows(hits)
  const checkAll = (val: boolean) => {
    if (val) {
      selectedItems.value = hits.value.map(genDocStr)
    } else {
      selectedItems.value = []
    }
  }
  const reload = () => {
    checkAll(false)
    setIndeterminate()
    emit('reload')
  }

  const genDocStr = (doc: ElasticsearchDocumentInfo) => [doc._index, doc._type, doc._id].join('####')

  const onRowsPerPageSelect = (value: number) => {
    searchStore.pagination.rowsPerPage = value
    if (value === rowsPerPage[rowsPerPage.length - 1].value) {
      searchStore.stickyTableHeader = true
    }
    onRequest({ pagination: searchStore.pagination })
  }

  watch(
    () => props.results,
    async (newValue: EsSearchResult) => {
      if (!newValue?.hits?.hits || newValue.hits.hits.length === 0) {
        hits.value = []
        return
      }

      const results = new SearchResults(newValue.hits.hits)
      const indices = await callElasticsearch('indexGet', { index: results.uniqueIndices })
      const allProperties: Record<string, any> = {}

      Object.keys(indices).forEach((index) => {
        const mappings = indices[index].mappings
        if (typeof mappings.properties === 'undefined') {
          // ES < 7
          const indexProperties = {}
          Object.keys(mappings).forEach((mapping) => {
            Object.assign(indexProperties, mappings[mapping].properties)
          })
          Object.assign(allProperties, indexProperties)
        } else {
          // ES >= 7
          Object.assign(allProperties, mappings.properties)
        }
      })

      tableColumns.value = results.uniqueColumns.map((field) => {
        const filterableCol = sortableField(field, allProperties[field])

        return { label: field, field, name: filterableCol || field, sortable: !!filterableCol, align: 'left' }
      })
      tableColumns.value.push({ label: '', name: 'actions' })

      const oldColumns = searchStore.columns
      const newColumnsList = tableColumns.value.map((c) => c.name)
      const addedColumns = newColumnsList.filter((c) => !oldColumns.includes(c))
      const removedColumns = oldColumns.filter((c) => !newColumnsList.includes(c))

      searchStore.columns = newColumnsList
      searchStore.visibleColumns = searchStore.visibleColumns.filter((c) => !removedColumns.includes(c)).concat(addedColumns)

      hits.value = results.docs
    }
  )

  const filteredHits = computed(() => {
    if (searchStore.filter.trim().length === 0) return hits.value

    return filterItems(
      hits.value,
      searchStore.filter,
      tableColumns.value.map((c) => c.field)
    )
  })

  const slicedTableColumns = computed((): any[] => tableColumns.value.slice(0, -1))

  const onRequest = (pagination: any) => emit('request', pagination)
  const clearColumns = () => (searchStore.visibleColumns = ['actions'])
  const resetColumns = () => (searchStore.visibleColumns = tableColumns.value.map((c) => c.name))
  const generateDownloadData = () => stringifyJson(props.results)

  const rowsPerPage = [
    { label: '10', value: 10, enabled: true },
    { label: '20', value: 20, enabled: true },
    { label: '100', value: 100, enabled: true },
    { label: '1000', value: 1000, enabled: true }
  ]

  const filterStateProps = setupFilterState(hits, filteredHits)

  const hasAggregations = computed(() => {
    return props.results?.aggregations && Object.keys(props.results.aggregations).length > 0
  })

  const aggregationsJson = computed(() => {
    if (!hasAggregations.value || !props.results.aggregations) return ''
    return stringifyJson(props.results.aggregations, null, 2)
  })

  watch(hasAggregations, (hasAggs) => {
    if (!hasAggs && activeTab.value === 'aggregations') {
      activeTab.value = 'hits'
    }
  })

  return {
    filterStateProps,
    tableColumns,
    searchStore,
    clearColumns,
    resetColumns,
    slicedTableColumns,
    resizeStore,
    hits,
    filteredHits,
    rowsPerPage,
    onRequest,
    onRowsPerPageSelect,
    reload,
    selectedItems,
    genDocStr,
    setIndeterminate,
    allItemsSelected,
    checkAll,
    generateDownloadData,
    hasAggregations,
    aggregationsJson,
    activeTab
  }
}
