import React, { useState } from 'react'
import { gql } from '@apollo/client/core'
import { useQuery, useMutation } from '@apollo/client/react'
import DOMPurify from 'dompurify'
import './App.css'

interface Comment {
  id: string
  userName: string
  email?: string
  text: string
  createdAt: string
  children?: Comment[]
}

interface QueryData {
  rootComments: Comment[]
}

interface MutationData {
  createComment: {
    success: boolean
    errors: string[]
    comment: Comment
  }
}

const COMMENT_FIELDS = gql`
  fragment CommentFields on CommentType {
    id
    userName
    text
    createdAt
  }
`

const GET_COMMENTS = gql`
  ${COMMENT_FIELDS}
  query GetRootComments {
    rootComments {
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
`

const CREATE_COMMENT = gql`
  ${COMMENT_FIELDS}
  mutation CreateComment($userName: String!, $email: String!, $text: String!, $parentId: ID) {
    createComment(userName: $userName, email: $email, text: $text, parentId: $parentId) {
      success
      errors
      comment {
        ...CommentFields
      }
    }
  }
`

function CommentForm({ parentId = null, onCompleted }: { parentId?: string | null, onCompleted?: () => void }) {
  const [userName, setUserName] = useState('')
  const [email, setEmail] = useState('')
  const [text, setText] = useState('')

  const [createComment, { loading, error, data }] = useMutation<MutationData>(CREATE_COMMENT, {
    refetchQueries: [{ query: GET_COMMENTS }],
    onCompleted: (mutationData) => {
      if (mutationData?.createComment?.success) {
        setUserName('')
        setEmail('')
        setText('')
        if (onCompleted) onCompleted()
      }
    }
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    createComment({ variables: { userName, email, text, parentId } })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <input required type="text" placeholder="Username" value={userName} onChange={e => setUserName(e.target.value)} style={{ padding: '8px' }} />
      <input required type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '8px' }} />
      <textarea required placeholder="Comment text (HTML tags like <strong>, <code> are allowed)..." value={text} onChange={e => setText(e.target.value)} rows={3} style={{ padding: '8px', resize: 'vertical' }} />
      <button type="submit" disabled={loading} style={{ padding: '10px', cursor: 'pointer', background: '#646cff', color: 'white', border: 'none', borderRadius: '4px' }}>
        {loading ? 'Submitting...' : 'Submit'}
      </button>

      {data?.createComment?.success === false && (
        <div style={{ color: 'red', fontSize: '14px', marginTop: '10px' }}>
          <strong>Error saving comment:</strong>
          {data.createComment.errors.map((err, i) => <p key={i} style={{margin: '5px 0 0 0'}}>{err}</p>)}
        </div>
      )}
      {error && <p style={{ color: 'red', margin: 0 }}>Network Error: {error.message}</p>}
    </form>
  )
}

function CommentNode({ comment }: { comment: Comment }) {
  const [isReplying, setIsReplying] = useState(false)

  return (
    <div style={{ borderLeft: '2px solid #ccc', paddingLeft: '15px', marginTop: '15px', textAlign: 'left' }}>
      <div style={{ padding: '15px', border: '1px solid #eee', borderRadius: '8px', background: '#fafafa' }}>
        <h4 style={{ margin: '0 0 5px 0', color: '#646cff' }}>{comment.userName}</h4>

        <div
          style={{ margin: '10px 0', color: '#333' }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.text) }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <small style={{ color: '#888' }}>{new Date(comment.createdAt).toLocaleString()}</small>
          <button
            onClick={() => setIsReplying(!isReplying)}
            style={{ background: 'transparent', border: 'none', color: '#646cff', cursor: 'pointer', padding: 0 }}
          >
            {isReplying ? 'Cancel' : 'Reply'}
          </button>
        </div>

        {isReplying && (
          <div style={{ marginTop: '15px' }}>
            <CommentForm parentId={comment.id} onCompleted={() => setIsReplying(false)} />
          </div>
        )}
      </div>

      {comment.children && comment.children.length > 0 && (
        <div style={{ marginLeft: '20px' }}>
          {comment.children.map(child => (
            <CommentNode key={child.id} comment={child} />
          ))}
        </div>
      )}
    </div>
  )
}

function App() {
  const { loading, error, data } = useQuery<QueryData>(GET_COMMENTS)

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>SPA Comments</h1>

      <h3>Leave a comment</h3>
      <CommentForm />

      <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #eee' }} />

      {loading && <h2>Loading comments...</h2>}

      {error && (
        <div style={{ color: 'red' }}>
          <h2>Error loading comments!</h2>
          <p>{error.message}</p>
        </div>
      )}

      {data?.rootComments?.length === 0 ? (
        <p>No comments yet. Be the first!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data?.rootComments?.map(comment => (
            <CommentNode key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  )
}

export default App
