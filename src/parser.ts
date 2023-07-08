import { ReadableStream, TransformStream } from 'stream/web'

export type JsonLine = unknown

/**
 * Options for parser
 */
export type ParserOptions<T extends JsonLine> = {
  /**
   * Parse each JSON line.
   * Errors are caught and passed to {@link ParserOptions.onError}
   */
  parser?: (line: string) => T
  /**
   * Callback for errors thrown by the parser.
   * If not provided, errors will be silently ignored.
   *
   * Note that this might be called multiple times for a stream, for each line.
   */
  onError?: (error: Error, line: string) => void
}

/**
 * Simple default parser for JSON lines
 *
 * Note that this will throw an error if the line is not valid JSON
 */
function parseJson<T extends JsonLine>(line: string): T {
  return JSON.parse(line) as T
}
/**
 * Transform a stream of Uint8Array, decoding to string and splitting on newlines
 *
 * Uses `parser` to parse each line into a JSON object
 *
 * @param options Parser and callbacks see {@link ParserOptions}
 *
 * For usage see {@link JsonLineStream}
 */
export function createLineStreamTransformer<T extends JsonLine>(
  options: ParserOptions<T> = {},
): TransformStream<Uint8Array, T> {
  const parser = options.parser ?? parseJson
  const textDecoder = new TextDecoder()
  let partialLine = ''
  return new TransformStream<Uint8Array, T>({
    transform(chunk, controller) {
      const textChunk = textDecoder.decode(chunk)
      const lines = (partialLine + textChunk).split('\n')

      partialLine = lines.pop() ?? ''

      lines.forEach((line) => {
        try {
          const parsed = parser(line)
          if (parsed) controller.enqueue(parsed)
        } catch (error) {
          options.onError?.(error as Error, line)
        }
      })
    },
    flush(controller) {
      if (partialLine === '') return
      try {
        const parsed = parser(partialLine)
        if (parsed) controller.enqueue(parsed)
      } catch (error) {
        options.onError?.(error as Error, partialLine)
      }
    },
  })
}

/**
 * Read a stream and return a readable stream of JSON objects
 *
 * @param stream The ReadableStream to read the string data
 * @param options Parser and callbacks see {@link ParserOptions}
 *
 * @example
 * // Get readable stream, such as from a `fetch` reponse.body
 * // or `fs.createReadStream("./data.jsonl")`
 * const jsonStream: ReadableStream<RowType> = JsonLineStream<RowType>(stream, parser);
 * jsonStream.getReader()
 */
export function JsonLineStream<T extends JsonLine>(
  stream: ReadableStream<Uint8Array>,
  options: ParserOptions<T> = {},
): ReadableStream<T> {
  const transformer = createLineStreamTransformer<T>(options)
  return stream.pipeThrough(transformer)
}

/**
 * Aggregate a stream of JSON objects into an array
 */
async function aggregateJsonStream<T extends JsonLine>(stream: ReadableStream<T>): Promise<T[]> {
  const aggregate: T[] = []
  const reader = stream.getReader()
  async function readChunk() {
    return reader.read().then(async (result) => {
      if (result.done) {
        return
      }
      aggregate.push(result.value)
      await readChunk()
    })
  }
  await readChunk()
  return aggregate
}

/**
 * Helper function to read a stream and aggregate into an array of JSON objects
 *
 * @param stream The ReadableStream to read the string data
 * @param options Parser and callbacks see {@link ParserOptions}
 *
 * @example
 * // Get readable stream, such as from a `fetch` reponse.body
 * const data: RowType[] = await JsonLines<RowType>(stream);
 * console.log("data", data.length);
 */
export async function JsonLines<T extends JsonLine>(
  stream: ReadableStream<Uint8Array>,
  options: ParserOptions<T> = {},
): Promise<T[]> {
  const jsonStream = JsonLineStream<T>(stream, options)
  return aggregateJsonStream(jsonStream)
}
