const REQUEST_LINE_REGEX = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.*)/

export type KibanaRequest = {
  method: string
  path: string
  body: string
  startLine: number
  endLine: number
}

export const parseKibanaRequests = (input: string): KibanaRequest[] => {
  if (!input.trim()) return []

  const lines = input.split('\n')
  const requests: KibanaRequest[] = []
  let current: KibanaRequest | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trimStart().startsWith('#')) continue

    const match = line.match(REQUEST_LINE_REGEX)
    if (match) {
      if (current) {
        current.endLine = i - 1
        while (current.endLine > current.startLine && lines[current.endLine].trim() === '') {
          current.endLine--
        }
        requests.push(current)
      }
      current = {
        method: match[1],
        path: match[2].trim(),
        body: '',
        startLine: i,
        endLine: i
      }
    } else if (current && line.trim() !== '') {
      current.body += (current.body ? '\n' : '') + line
      current.endLine = i
    }
  }

  if (current) {
    current.endLine = lines.length - 1
    while (current.endLine > current.startLine && lines[current.endLine].trim() === '') {
      current.endLine--
    }
    requests.push(current)
  }

  return requests
}

export const getRequestAtLine = (requests: KibanaRequest[], line: number): KibanaRequest | null => {
  return requests.find(r => line >= r.startLine && line <= r.endLine) || null
}

export const getActiveRequestAtLine = (requests: KibanaRequest[], line: number): KibanaRequest | null => {
  const exact = getRequestAtLine(requests, line)
  if (exact) return exact
  let active: KibanaRequest | null = null
  for (const request of requests) {
    if (request.startLine <= line) active = request
    else break
  }
  return active
}
