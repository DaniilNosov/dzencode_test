import React, { useState, useRef } from 'react'
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
  file?: string | null // ДОБАВЛЕНО ПОЛЕ
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

// ДОБАВЛЕНА ПЕРЕМЕННАЯ $file ТИПА Upload
const CREATE_COMMENT = gql`
  ${COMMENT_FIELDS}
  mutation CreateComment($userName: String!, $email: String!, $text: String!, $parentId: ID, $file: Upload) {
    createComment(userName: $userName, email: $email, text: $text, parentId: $parentId, file: $file) {
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
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null) // ДОБАВЛЕН СТЕЙТ ФАЙЛА

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [createComment, { loading, error, data }] = useMutation<MutationData>(CREATE_COMMENT, {
    refetchQueries: ["GetRootComments"],
    onCompleted: (mutationData) => {
      if (mutationData?.createComment?.success) {
        setUserName('')
        setEmail('')
        setText('')
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = '' // Очищаем инпут
        if (onCompleted) onCompleted()
      }
    }
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Передаем file вместе с остальными переменными
    createComment({ variables: { userName, email, text, parentId, file } })
  }

  return (
    <div className="comment-form-card">
      <form onSubmit={handleSubmit} className="comment-form">
        <input className="form-input" required type="text" placeholder="Username" value={userName} onChange={e => setUserName(e.target.value)} />
        <input className="form-input" required type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <textarea className="form-textarea" required placeholder="Write a comment... (HTML tags <strong>, <code> allowed)" value={text} onChange={e => setText(e.target.value)} rows={3} />

        {/* ИНПУТ ДЛЯ ФАЙЛА */}
        <div className="file-input-wrapper">
          <input
            type="file"
            className="form-file"
            ref={fileInputRef}
            accept=".jpg,.jpeg,.png,.gif,.txt"
            onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
          />
        </div>

        <button type="submit" disabled={loading} className="btn-submit">
          {loading ? 'Submitting...' : 'Post Comment'}
        </button>

        {data?.createComment?.success === false && (
          <div className="error-message">
            <strong>Error saving comment:</strong>
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

  // Базовый URL для файлов (Django отдает относительный путь, мы добавляем хост)
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
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.text) }}
        />

        {/* РЕНДЕР ПРИКРЕПЛЕННОГО ФАЙЛА */}
        {fileUrl && (
          <div className="comment-attachment">
            {isImage ? (
              <a href={fileUrl} target="_blank" rel="noreferrer">
                <img src={fileUrl} alt="attachment" className="attachment-image" />
              </a>
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

  const { loading, error, data } = useQuery<QueryData>(GET_COMMENTS, {
    variables: { orderBy, page }
  })

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
