/** Bound an arbitrary local cover image before storing it in roaming preferences. */
export async function importCoverImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) throw new Error("请选择不超过 8 MB 的图片 / Choose an image under 8 MB.");
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 480 / image.width, 720 / image.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image canvas unavailable.");
    context.fillStyle = "#fff"; context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL("image/jpeg",0.8);
  } finally { image.close(); }
}
