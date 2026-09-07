import { ref, watch } from 'vue'
import { useSnackbar } from '../../Snackbar'
import { useElasticsearchAdapter } from '../../CallElasticsearch'
import { useTranslation } from '../../i18n'
import { stringifyJson } from '../../../helpers/json/stringify.ts'
import { parseJson } from '../../../helpers/json/parse.ts'

const NON_DYNAMIC_INDEX_SETTINGS = [
  'uuid',
  'provided_name',
  'creation_date',
  'creation_date_string',
  'version',
  'number_of_shards',
  'routing_partition_size',
  'resize',
  'verified_before_close',
  'history'
]

export type IndexSettingsProps = {
  index: string
}

export const useIndexSettings = (props: IndexSettingsProps, emit: any) => {
  const t = useTranslation()
  const { showSnackbar, showErrorSnackbar } = useSnackbar()
  const { requestState, callElasticsearch } = useElasticsearchAdapter()

  const dialog = ref(false)
  const settings = ref('')

  watch(dialog, (value) => {
    if (value) loadSettings()
  })

  const loadSettings = () => {
    callElasticsearch('indexGetSettings', { index: props.index })
      .then((body) => {
        const indexSettings = { ...(body[props.index]?.settings?.index ?? {}) }
        for (const key of NON_DYNAMIC_INDEX_SETTINGS) delete indexSettings[key]
        settings.value = stringifyJson({ index: indexSettings }, null, 2)
      })
      .catch(() => {
        settings.value = ''
        showSnackbar(requestState.value)
      })
  }

  const updateSettings = () => {
    let body: object
    try {
      body = parseJson(settings.value)
    } catch (_e) {
      showErrorSnackbar({ title: t('indices.index_settings.invalid_json') })
      return
    }

    callElasticsearch('indexPutSettings', { indices: [props.index], body })
      .then(() => {
        showSnackbar(requestState.value, { body: t('indices.index_settings.growl', { index: props.index }) })
        dialog.value = false
        emit('reload')
      })
      .catch(() => {
        showSnackbar(requestState.value)
      })
  }

  return {
    dialog,
    requestState,
    settings,
    updateSettings
  }
}
