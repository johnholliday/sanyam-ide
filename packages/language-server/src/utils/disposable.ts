/**
 * Disposable utilities
 *
 * Provides a simple DisposableCollection implementation since
 * vscode-languageserver doesn't export one.
 *
 * @packageDocumentation
 */

import { Disposable } from 'vscode-languageserver';

/**
 * A collection of disposables that can be disposed together.
 */
export class DisposableCollection implements Disposable {
  private readonly disposables: Disposable[] = [];
  private disposed = false;

  /**
   * Add a disposable to the collection.
   */
  push(disposable: Disposable): Disposable {
    if (this.disposed) {
      disposable.dispose();
    } else {
      this.disposables.push(disposable);
    }
    return disposable;
  }

  /**
   * Add multiple disposables to the collection.
   */
  pushAll(...disposables: Disposable[]): void {
    for (const disposable of disposables) {
      this.push(disposable);
    }
  }

  /**
   * Dispose all contained disposables.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables.length = 0;
  }

  /**
   * Whether this collection has been disposed.
   */
  get isDisposed(): boolean {
    return this.disposed;
  }
}
