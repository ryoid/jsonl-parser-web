import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import { ReadableStream } from 'node:stream/web';
import { Readable } from 'node:stream';
import { JsonLines, ParserOptions } from '../src';

const objectData = [
  { id: 1, message: 'Hello' },
  { id: 2, message: 'Hello' },
  { id: 3, message: 'Hello' },
];
type ObjectData = typeof objectData[number];

const arrayData = [
  [1, 'Hello'],
  [2, 'Hello'],
  [3, 'Hello'],
];
type ArrayData = typeof arrayData[number];

const arrayObjectMixData = [
  [1, 'Hello'],
  { id: 2, message: 'Hello' },
  [3, 'Hello'],
];
type ArrayObjectMixData = typeof arrayObjectMixData[number];

const dataDir = `${__dirname}/testdata`;

function readTestDataAsReadableStream(name: string): ReadableStream<Uint8Array> {
  const nodeReadable = fs.createReadStream(`${dataDir}/${name}.jsonl`);
  const webReadableStream = Readable.toWeb(nodeReadable); // convert to web stream
  return webReadableStream;
}

describe('JsonLines', () => {
  it('empty', async () => {
    const stream = readTestDataAsReadableStream('empty');
    const result = await JsonLines<ObjectData>(stream);

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(0);
  });
  it('empty-mix', async () => {
    const stream = readTestDataAsReadableStream('empty-mix');
    const result = await JsonLines(stream);

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(4);
    expect(result).toMatchObject([{},[],{},[]]);
  });
  it('object', async () => {
    const stream = readTestDataAsReadableStream('object');
    const result = await JsonLines<ObjectData>(stream);

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(3);
    expect(result).toMatchObject(objectData);
  });
  it('array', async () => {
    const stream = readTestDataAsReadableStream('array');
    const result = await JsonLines<ArrayData>(stream);

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(3);
    expect(result).toMatchObject(arrayData);
  });
  it('array object mix', async () => {
    const stream = readTestDataAsReadableStream('array-object-mix');
    const result = await JsonLines<ArrayObjectMixData>(stream);

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(3);
    expect(result).toMatchObject(arrayObjectMixData);
  });

  const encoder = new TextEncoder()
  it('partial object', async () => {
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const stream = new ReadableStream({ // (A)
      start(controller) {
        streamController = controller;
        controller.enqueue(encoder.encode('{"id":1,"message":"Hello"}\n'));
        controller.enqueue(encoder.encode('{"id":2'));
      },
    });

    JsonLines<ArrayObjectMixData>(stream).then(result => {
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(3);
      expect(result).toMatchObject(objectData);
    });
    await new Promise(resolve => setTimeout(resolve, 100))
    if (!streamController) {
      throw new Error('streamController Object is undefined');
    }
    streamController.enqueue(encoder.encode(',"message":"Hello"}\n'));
    await new Promise(resolve => setTimeout(resolve, 100))
    streamController.enqueue(encoder.encode('{"id":3,"message":"Hello"}\n'));
    streamController.close();
  });
  it('parsing error', async () => {
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const stream = new ReadableStream({ // (A)
      start(controller) {
        streamController = controller;
        controller.enqueue(encoder.encode('{"id":1,"message":"Hello"}\n'));
        controller.enqueue(encoder.encode('{"id":2\n')); // Malformed JSON with '\n' breaking the object
      },
    });

    const options = {
       onError: (error: Error, line: string) => {
        // {"id":2
        // ,"me
        // ssage":"Hello"}
        expect(error).toBeInstanceOf(Error);
      }
    } satisfies ParserOptions<ArrayObjectMixData>;
    vi.spyOn(options, "onError")

    JsonLines<ArrayObjectMixData>(stream, options).then(result => {
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(2);
      expect(result).toMatchObject([
        { id: 1, message: 'Hello' },
        { id: 3, message: 'Hello' }
      ]);

      expect(options.onError).toBeCalledTimes(3);
    });
    await new Promise(resolve => setTimeout(resolve, 100))
    if (!streamController) {
      throw new Error('streamController Object is undefined');
    }
    streamController.enqueue(encoder.encode(',"me\nssage":"Hello"}\n'));
    await new Promise(resolve => setTimeout(resolve, 100))
    streamController.enqueue(encoder.encode('{"id":3,"message":"Hello"}\n'));
    streamController.close();
  });
});
