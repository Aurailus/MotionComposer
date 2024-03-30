/* @jsxImportSource preact */

import styles from './Footer.module.scss';

import { useShortcuts } from '../Contexts';
import { ShortcutMappings } from './ShortcutMappings';

/** Renders shortcuts, basically ripped straight from Motion Canvas because it's not exported -.- */

export function FooterShortcuts() {
  const { currentModule } = useShortcuts();

  return (
		<div className={styles.shortcuts}>
			{ShortcutMappings[currentModule]
				.filter(({ available }) => !available || available())
				.map(({ key, action }) => (
					<div className={styles.shortcut}>
						<code className={styles.key}>{key.replace('Control', 'Ctrl')}</code>
						<span className={styles.action}>{action}</span>
					</div>
				))}
		</div>
  );
}
