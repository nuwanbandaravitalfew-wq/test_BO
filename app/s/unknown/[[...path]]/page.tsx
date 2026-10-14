import { notFound } from "next/navigation";

// Every path on an unrecognised host renders app/not-found.tsx with HTTP 404.
export default function UnknownHost() {
  notFound();
}
