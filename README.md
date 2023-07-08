# jsonl-parser-web

Simple JSONLines parser (``.jsonl``) that works with streams for web runtime, with Typescript support. The goal was to have a simple API for a specific use case.

Current only supports stream inputs.

## Installation
```
npm install jsonlines-p
yarn add jsonlines-p
pnpm add jsonlines-p
```

## Usage

### Fetch

Pass the respones body to the parser. 

```typescript
import { JsonLines, JsonLineStream } from 'jsonlines-p';

const response = await fetch("/remote/items.jsonl");
// Aggregates the lines into an array.
const items = await JsonLines<Item>(response.body);
// or if you want to access the stream directly
const stream = JsonLineStream<Item>(response.body);
```

### Options

Use a custom line parser and error handler.

```typescript
// Usage
JsonLines(response.body, options)

export type ParserOptions<T extends JsonLine> = {
  /**
   * Parse each JSON line.
   */
  parser?: (line: string) => T, 
  /**
   * Callback for errors thrown by the parser.
   * If not provided, errors will be silently ignored.
   * 
   * Note that this might be called multiple times for a stream, for each line.
   */
  onError?: (error: Error, line: string) => void;
}
```

### Internals

These are also exported if you need more control.

```typescript
export function createLineStreamTransformer<T>(
  options: ParserOptions<T> = {}
): TransformStream<Uint8Array, T>
```

## License

The MIT License.