import { Toaster as Sonner } from 'sonner';

/**
 * Renders the toast container. Use with `toast()` from this module for messages
 * with title, description, actions, and variants (success, error, warning).
 *
 * @example
 * toast("Event has been created", {
 *   description: "Sunday, December 03, 2023 at 9:00 AM",
 *   action: { label: "Undo", onClick: () => {} },
 * });
 * toast.success("Saved!");
 * toast.error("Something went wrong");
 * toast.warning("Please review");
 */
export function Toaster() {
  // Top-center placement with a close button on every toast — the cart
  // "added" success message benefits from sitting prominently at the top.
  return <Sonner position="top-center" richColors closeButton />;
}

export { toast } from 'sonner';
