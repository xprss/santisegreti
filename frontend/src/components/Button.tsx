import type { ButtonHTMLAttributes, ComponentType } from 'react'
import BsButton, { type ButtonProps as BsButtonProps } from 'react-bootstrap/Button'

export type ButtonProps = Omit<BsButtonProps, 'as' | 'href'> &
  ButtonHTMLAttributes<HTMLButtonElement>

/**
 * Il Button di React Bootstrap con tipi semplificati: il suo tipo polimorfico (`as`) manda
 * TypeScript in TS2590 ("union type too complex") con React 19. Qui serve solo come <button>;
 * per i link si usa <Link className="btn …">.
 */
export const Button = BsButton as unknown as ComponentType<ButtonProps>
