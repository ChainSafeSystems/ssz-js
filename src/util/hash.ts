import {keccak256} from "js-sha3";

import {
  SerializableType,
  SerializableValue,
} from "../types";

import { BYTES_PER_CHUNK } from "../constants";

import { size } from "../size";

import { _serialize } from "../serialize";

export function pack (input: SerializableValue[], type: SerializableType): Buffer[] {
  const packedLength = input.map((v) => size(v, type)).reduce((a, b) => a + b);
  const packedBuf = Buffer.alloc(packedLength);
  let index = 0;
  for (const v of input) {
    index = _serialize(v, type, packedBuf, index);
  }
  const chunkLength = Math.ceil(packedLength / BYTES_PER_CHUNK);
  const chunks = Array.from({ length: chunkLength },
    (_, i) => packedBuf.slice(i * BYTES_PER_CHUNK, i * BYTES_PER_CHUNK + BYTES_PER_CHUNK));
  const lastChunk = chunks[chunkLength - 1];
  if (lastChunk.length < BYTES_PER_CHUNK) {
    chunks[chunkLength - 1] = Buffer.concat([lastChunk, Buffer.alloc(BYTES_PER_CHUNK - lastChunk.length)]);
  }
  return chunks;
}

function bitLength (n: number): number {
  let length = 0;
  while (n !== 0) {
    n = n >> 1;
    length++;
  }
  return length;
}

function nextPowerOf2 (n: number): number {
  return n === 0 ? 1 : Math.pow(2, bitLength(n - 1));
}

export function hash(input: Buffer): Buffer {
  return Buffer.from(keccak256.arrayBuffer(input));
}

export function merkleize(chunks: Buffer[]): Buffer {
  const lengthToPad = nextPowerOf2(chunks.length) - chunks.length;
  if (lengthToPad) {
    // Add zeroed chunks as leaf nodes to create full binary tree
    const emptyChunk = Buffer.alloc(BYTES_PER_CHUNK);
    chunks = chunks.concat(
      Array.from({ length: lengthToPad }, () => emptyChunk)
    );
  }
  while (chunks.length > 1) {
    for (let i = 0; i < chunks.length; i += 2) {
      chunks[i / 2] = hash(Buffer.concat([chunks[i], chunks[i + 1]]));
    }
    chunks.splice(chunks.length / 2, chunks.length / 2);
  }
  return hash(chunks[0]);
}

export function mixInLength(root: Buffer, length: number): Buffer {
  const buf = Buffer.alloc(64);
  root.copy(buf);
  buf.writeUInt32LE(length, 32);
  return hash(buf);
}