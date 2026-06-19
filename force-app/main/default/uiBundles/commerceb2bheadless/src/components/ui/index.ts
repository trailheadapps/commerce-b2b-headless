/**
 * UI Components Index
 *
 * Re-exports the UI primitives currently used by the app for ergonomic
 * grouped imports.
 *
 * Usage:
 *   import { Button, Input } from "@/components/ui"
 *
 * Instead of:
 *   import { Button } from "@/components/ui/button"
 *   import { Input } from "@/components/ui/input"
 *
 * If you add a new shadcn primitive, re-export it here.
 */

export { Alert, AlertTitle, AlertDescription, AlertAction } from './alert';
export { Button, buttonVariants } from './button';
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from './card';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './dialog';
export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './dropdown-menu';
export {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from './field';
export { Input } from './input';
export { Label } from './label';
export { Spinner } from './spinner';
export { Skeleton } from './skeleton';
export { Separator } from './separator';
