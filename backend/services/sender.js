// services/sender.js
async function sendWithVenom(client, to, payload) {
  const { type, text, caption, media } = payload;

  if (type === 'text') {
    return client.sendText(to, text);
  }

  if (type === 'image') {
    // image: jpg/png
    return client.sendImage(
      to,
      media.path,
      media.filename || 'image.jpg',
      caption || ''
    );
  }

  if (type === 'document') {
    // pdf/doc/xlsx dll
    return client.sendFile(
      to,
      media.path,
      media.filename || media.originalName || 'document.pdf',
      caption || ''
    );
  }

  throw new Error('Unsupported type');
}

module.exports = { sendWithVenom };
