import React, { useState, useRef, useEffect } from 'react'
import { gql, useQuery, useMutation } from '@apollo/client'
import DOMPurify from 'dompurify'
import './App.css'

// --- TYPES ---
interface Comment {
  id: string
  userName: string
  email?: string
  text: string
  createdAt: string
  file?: string | null
  children?: Comment[]
}

interface QueryData {
  rootComments: {
    comments: Comment[]
    totalPages: number
    currentPage: number
  }
}

interface MutationData {
  createComment: {
    success: boolean
    errors: string[]
    comment: Comment
  }
}

// Строгие настройки для DOMPurify (только разрешенные теги)
const purifyConfig = {
  ALLOWED_TAGS: ['a', 'code', 'i', 'strong'],
  ALLOWED_ATTR: ['href', 'title']
}

// --- GRAPHQL ---
const COMMENT_FIELDS = gql`
  fragment CommentFields on CommentType {
    id
    userName
    text
    createdAt
    file 
  }
`

const GET_COMMENTS = gql`
  ${COMMENT_FIELDS}
  query GetRootComments($orderBy: String, $page: Int) {
    rootComments(orderBy: $orderBy, page: $page) {
      totalPages
      currentPage
      comments {
        ...CommentFields
        children {
          ...CommentFields
          children {
            ...CommentFields
            children {
              ...CommentFields
            }
          }
        }
      }
    }
  }
`

const GET_CAPTCHA = gql`
  query GetCaptcha {
    captcha {
      key
      image
    }
  }
`

const CREATE_COMMENT = gql`
  ${COMMENT_FIELDS}
  mutation CreateComment($userName: String!, $email: String!, $text: String!, $homePage: String, $parentId: ID, $file: Upload, $captchaKey: String!, $captchaValue: String!) {
    createComment(userName: $userName, email: $email, text: $text, homePage: $homePage, parentId: $parentId, file: $file, captchaKey: $captchaKey, captchaValue: $captchaValue) {
      success
      errors
      comment {
        ...CommentFields
      }
    }
  }
`

// --- COMPONENTS ---
function CommentForm({ parentId = null, onCompleted }: { parentId?: string | null, onCompleted?: () => void }) {
  const [userName, setUserName] = useState('')
  const [email, setEmail] = useState('')
  const [homePage, setHomePage] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [captchaValue, setCaptchaValue] = useState('')

  const [isPreview, setIsPreview] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: captchaData, refetch: refetchCaptcha } = useQuery(GET_CAPTCHA, { fetchPolicy: 'network-only' })

  const [createComment, { loading, error, data }] = useMutation<MutationData>(CREATE_COMMENT, {
    refetchQueries: ["GetRootComments"],
    onCompleted: (mutationData) => {
      if (mutationData?.createComment?.success) {
        setUserName('')
        setEmail('')
        setHomePage('')
        setText('')
        setFile(null)
        setCaptchaValue('')
        setIsPreview(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        if (onCompleted) onCompleted()
      }
      refetchCaptcha()
    }
  })

  const insertTag = (openTag: string, closeTag: string) => {
    const textarea = textRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = text.substring(start, end)
    const newText = text.substring(0, start) + openTag + selectedText + closeTag + text.substring(end)

    setText(newText)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + openTag.length, end + openTag.length)
    }, 0)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!captchaData?.captcha?.key) return

    createComment({
      variables: {
        userName,
        email,
        homePage: homePage || null,
        text,
        parentId,
        file,
        captchaKey: captchaData.captcha.key,
        captchaValue
      }
    })
  }

  return (
    <div className="comment-form-card">
      <form onSubmit={handleSubmit} className="comment-form">
        <input className="form-input" required type="text" placeholder="Username (letters and digits)" pattern="[A-Za-z0-9]+" title="Only letters and digits allowed" value={userName} onChange={e => setUserName(e.target.value)} />
        <input className="form-input" required type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="form-input" type="url" placeholder="Home page (optional URL)" value={homePage} onChange={e => setHomePage(e.target.value)} />

        <div className="toolbar">
          <button type="button" className="btn-toolbar" onClick={() => insertTag('<i>', '</i>')}>[i]</button>
          <button type="button" className="btn-toolbar" onClick={() => insertTag('<strong>', '</strong>')}>[strong]</button>
          <button type="button" className="btn-toolbar" onClick={() => insertTag('<code>', '</code>')}>[code]</button>
          <button type="button" className="btn-toolbar" onClick={() => insertTag('<a href="" title="">', '</a>')}>[a]</button>

          <button type="button" className="btn-toolbar btn-preview-toggle" onClick={() => setIsPreview(!isPreview)}>
            {isPreview ? 'Back to Edit' : 'Preview'}
          </button>
        </div>

        {isPreview ? (
          <div
            className="preview-box"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(text, purifyConfig) || '<span style="color: gray">Nothing to preview...</span>' }}
          />
        ) : (
          <textarea
            ref={textRef}
            className="form-textarea"
            required
            placeholder="Write a comment... (HTML tags allowed)"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
          />
        )}

        <div className="file-input-wrapper">
          <input
            type="file"
            className="form-file"
            ref={fileInputRef}
            accept=".jpg,.jpeg,.png,.gif,.txt"
            onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px', marginBottom: '12px' }}>
          {captchaData?.captcha && (
            <>
              <img
                src={`data:image/png;base64,${captchaData.captcha.image}`}
                alt="CAPTCHA"
                style={{ borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer', height: '40px' }}
                onClick={() => refetchCaptcha()}
                title="Click to refresh image"
              />
              <input
                className="form-input"
                required
                type="text"
                placeholder="Enter text from image"
                value={captchaValue}
                onChange={e => setCaptchaValue(e.target.value)}
                style={{ margin: 0, flex: 1, padding: '10px' }}
              />
            </>
          )}
        </div>

        <button type="submit" disabled={loading} className="btn-submit">
          {loading ? 'Submitting...' : 'Post Comment'}
        </button>

        {data?.createComment?.success === false && (
          <div className="error-message">
            <strong>Error:</strong>
            {data.createComment.errors.map((err, i) => <p key={i}>{err}</p>)}
          </div>
        )}
        {error && <p className="error-message">Network Error: {error.message}</p>}
      </form>
    </div>
  )
}

function CommentNode({ comment }: { comment: Comment }) {
  const [isReplying, setIsReplying] = useState(false)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  const fileUrl = comment.file ? `http://localhost:8000/media/${comment.file}` : null
  const isImage = comment.file?.match(/\.(jpeg|jpg|gif|png)$/i) != null

  return (
    <div className="comment-thread">
      <div className="comment-node">
        <div className="comment-header">
          <h4 className="comment-author">{comment.userName}</h4>
          <span className="comment-date">{new Date(comment.createdAt).toLocaleString()}</span>
        </div>

        <div
          className="comment-body"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.text, purifyConfig) }}
        />

        {fileUrl && (
          <div className="comment-attachment">
            {isImage ? (
              <>
                <img
                  src={fileUrl}
                  alt="attachment"
                  className="attachment-image"
                  onClick={() => setIsLightboxOpen(true)}
                />

                {isLightboxOpen && (
                  <div className="lightbox-overlay" onClick={() => setIsLightboxOpen(false)}>
                    <img src={fileUrl} alt="fullscreen" className="lightbox-image" />
                  </div>
                )}
              </>
            ) : (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="attachment-link">
                📎 Download .txt attachment
              </a>
            )}
          </div>
        )}

        <div className="comment-actions">
          <button onClick={() => setIsReplying(!isReplying)} className="btn-reply">
            {isReplying ? 'Cancel' : 'Reply'}
          </button>
        </div>

        {isReplying && (
          <div className="reply-form-wrapper">
            <CommentForm parentId={comment.id} onCompleted={() => setIsReplying(false)} />
          </div>
        )}
      </div>

      {comment.children && comment.children.length > 0 && (
        <div className="replies-container">
          {comment.children.map(child => (
            <CommentNode key={child.id} comment={child} />
          ))}
        </div>
      )}
    </div>
  )
}

function App() {
  const [orderBy, setOrderBy] = useState('-created_at')
  const [page, setPage] = useState(1)

  // Достаем функцию refetch из useQuery для ручного обновления при сигнале от WebSocket
  const { loading, error, data, refetch } = useQuery<QueryData>(GET_COMMENTS, {
    variables: { orderBy, page }
  })

  // ПОДКЛЮЧАЕМ WEBSOCKET
  useEffect(() => {
    console.log("Пытаемся подключиться к WebSocket...")
    const ws = new WebSocket('ws://localhost:8000/ws/comments/')

    ws.onopen = () => {
      console.log('✅ WebSocket успешно подключен!')
    }

    ws.onmessage = (event) => {
      console.log('📩 Получено сообщение от сервера:', event.data)
      const parsedData = JSON.parse(event.data)
      if (parsedData.message === 'new_comment') {
        // Получили сигнал о новом комментарии — обновляем список
        refetch()
      }
    }

    ws.onerror = (error) => {
      console.error('❌ Ошибка WebSocket:', error)
    }

    // Чистим соединение при закрытии компонента
    return () => {
      console.log("Закрываем соединение WebSocket...")
      ws.close()
    }
  }, [refetch])

  const handleSortChange = (newOrderBy: string) => {
    setOrderBy(newOrderBy)
    setPage(1)
  }

  const SortButton = ({ field, label }: { field: string, label: string }) => {
    const isActive = orderBy === field || orderBy === `-${field}`
    const isDesc = orderBy.startsWith('-')

    const toggleSort = () => {
      if (isActive) {
        handleSortChange(isDesc ? field : `-${field}`)
      } else {
        handleSortChange(field === 'created_at' ? '-created_at' : field)
      }
    }

    return (
      <button className={`btn-sort ${isActive ? 'active' : ''}`} onClick={toggleSort}>
        {label} {isActive && (isDesc ? '↓' : '↑')}
      </button>
    )
  }

  const paginatedData = data?.rootComments

  return (
    <div className="container">
      <h1 className="header-title">Discussions</h1>

      <CommentForm />

      <div className="sort-panel">
        <span className="sort-label">Sort by:</span>
        <SortButton field="created_at" label="Date" />
        <SortButton field="user_name" label="Username" />
        <SortButton field="email" label="Email" />
      </div>

      {loading && <h2>Loading comments...</h2>}

      {error && (
        <div className="error-message">
          <strong>Error loading comments!</strong>
          <p>{error.message}</p>
        </div>
      )}

      {paginatedData?.comments?.length === 0 ? (
        <p>No comments yet. Be the first!</p>
      ) : (
        <div className="comments-list">
          {paginatedData?.comments?.map(comment => (
            <CommentNode key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {paginatedData && paginatedData.totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn-page"
            disabled={paginatedData.currentPage === 1 || loading}
            onClick={() => setPage(prev => prev - 1)}
          >
            Previous
          </button>

          <span className="page-info">
            Page {paginatedData.currentPage} of {paginatedData.totalPages}
          </span>

          <button
            className="btn-page"
            disabled={paginatedData.currentPage === paginatedData.totalPages || loading}
            onClick={() => setPage(prev => prev + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default App
