// jest's jsdom test environment doesn't expose the Web Streams / fetch
// globals that jsdom (via undici) expects to find on `global`.
const { ReadableStream, WritableStream, TransformStream } = require('node:stream/web');

if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = ReadableStream;
}
if (typeof global.WritableStream === 'undefined') {
  global.WritableStream = WritableStream;
}
if (typeof global.TransformStream === 'undefined') {
  global.TransformStream = TransformStream;
}

const { MessageChannel, MessagePort } = require('node:worker_threads');
if (typeof global.MessageChannel === 'undefined') {
  global.MessageChannel = MessageChannel;
}
if (typeof global.MessagePort === 'undefined') {
  global.MessagePort = MessagePort;
}
