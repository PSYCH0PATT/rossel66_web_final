export const progressControllers = new Map<string, ReadableStreamDefaultController>();

export function getProgressResponse(id: string) {
  const stream = new ReadableStream({
    start(controller) {
      progressControllers.set(id, controller);
    },
    cancel() {
      progressControllers.delete(id);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export function pushProgress(id: string, percent: number) {
  const controller = progressControllers.get(id);
  if (!controller) return;
  controller.enqueue(`data: ${percent}\n\n`);
  if (percent >= 100) {
    controller.close();
    progressControllers.delete(id);
  }
} 