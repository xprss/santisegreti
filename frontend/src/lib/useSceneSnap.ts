import { useEffect } from 'react'

/** Finché la pagina è aperta, lo scroll si aggancia alla scena (solo sul telefono, via CSS). */
export function useSceneSnap() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('ss-snap')
    return () => root.classList.remove('ss-snap')
  }, [])
}
