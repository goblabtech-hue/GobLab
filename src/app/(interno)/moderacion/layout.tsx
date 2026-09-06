import { guardarSeccion } from '../guardia'

export default async function Layout({ children }: { children: React.ReactNode }) {
  return (await guardarSeccion(['supervisor', 'admin'])) ?? children
}
