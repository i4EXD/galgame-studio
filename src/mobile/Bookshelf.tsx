/* 书架：应用内玩已经导出的作品（导出的 HTML 同时存进 App 私有目录） */
import { useEffect, useState } from 'react';
import { bookUrl, deleteBook, isNativeApp, listBooks, type GalBookEntry } from './bridge';
import { Btn, Empty, Icon } from '../ui';
import { store } from '../store';

function formatWhen(ts: number): string {
  if (!ts) return '';
  const date = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function Bookshelf({ onClose, reading, onReadingChange }: {
  onClose: () => void;
  reading: GalBookEntry | null;
  onReadingChange: (book: GalBookEntry | null) => void;
}) {
  const [books, setBooks] = useState<GalBookEntry[]>(() => listBooks());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => { setBooks(listBooks()); }, []);

  if (reading) {
    const url = bookUrl(reading.id);
    return (
      <div className="gm-fullscreen is-reader">
        {url
          ? <iframe className="gm-reader" src={url} title={reading.name} />
          : <div className="gm-reader-fallback"><Empty icon="warn" title="这个作品打不开了" hint="文件可能已被删除，重新导出一份即可。" /></div>}
        <button className="gm-close" onClick={() => onReadingChange(null)} aria-label="退出阅读"><Icon name="close" size={20} /></button>
      </div>
    );
  }

  return (
    <div className="gm-sheet-backdrop" onClick={onClose}>
      <div className="gm-sheet is-menu" onClick={event => event.stopPropagation()}>
        <div className="gm-sheet-head">
          <span className="gm-sheet-grip" />
          <strong>我的书架</strong>
          <button className="gm-icon" onClick={onClose} aria-label="关闭"><Icon name="close" size={16} /></button>
        </div>
        <div className="gm-sheet-body">
          {books.length ? (
            <div className="gm-booklist">
              {books.map(book => (
                <div key={book.id} className="gm-book">
                  <button className="gm-book-main" onClick={() => onReadingChange(book)}>
                    <span className="gm-book-icon"><Icon name="book" size={18} /></span>
                    <span className="gm-book-body">
                      <b>{book.name}</b>
                      <small>{[formatWhen(book.savedAt), formatSize(book.bytes)].filter(Boolean).join(' · ')}</small>
                    </span>
                    <Icon name="play" size={16} />
                  </button>
                  <button className="gm-book-del" onClick={() => setConfirmId(book.id)} aria-label="删除"><Icon name="trash" size={15} /></button>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon="book"
              title="书架还是空的"
              hint={isNativeApp()
                ? '去「发布」里导出一次单文件 HTML，作品就会出现在这里，点开就能直接玩。'
                : '在应用版里导出作品后，就能在这里直接阅读。'}
              action={<Btn kind="solid" icon="rocket" onClick={onClose}>去导出</Btn>}
            />
          )}
          <p className="gs-note">导出的作品同时保存在手机的「下载/GalgameStudio」目录，可以直接发给朋友。</p>
        </div>
      </div>

      {confirmId && (
        <div className="gm-sheet-backdrop is-front" onClick={() => setConfirmId(null)}>
          <div className="gm-confirm" onClick={event => event.stopPropagation()}>
            <p>确定要从书架里删掉这部作品吗？（手机「下载」目录里的文件不会被删除）</p>
            <div className="gs-row">
              <Btn kind="quiet" onClick={() => setConfirmId(null)}>取消</Btn>
              <Btn kind="danger" onClick={() => {
                const id = confirmId;
                deleteBook(id);
                setConfirmId(null);
                setBooks(listBooks());
                store.toast('已从书架移除');
              }}>删除</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
