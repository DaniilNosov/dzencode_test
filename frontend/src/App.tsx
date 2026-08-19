import { gql } from '@apollo/client/core'
import { useQuery } from '@apollo/client/react'
import './App.css'

interface Comment {
  id: string;
  userName: string;
  text: string;
  createdAt: string;
}

interface QueryData {
  rootComments: Comment[];
}

const GET_COMMENTS = gql`
  query GetRootComments {
    rootComments {
      id
      userName
      text
      createdAt
    }
  }
`

function App() {
  const { loading, error, data } = useQuery<QueryData>(GET_COMMENTS)

  if (loading) return <h2>Loading comments...</h2>

  if (error) {
    return (
      <div style={{ color: 'red' }}>
        <h2>Error fetching comments!</h2>
        <p>{error.message}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>SPA Comments</h1>

      {data?.rootComments?.length === 0 ? (
        <p>No comments yet. Be the first!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {data?.rootComments?.map((comment) => (
            <div
              key={comment.id}
              style={{
                border: '1px solid #ccc',
                padding: '15px',
                borderRadius: '8px',
                textAlign: 'left'
              }}
            >
              <h3 style={{ margin: '0 0 10px 0', color: '#646cff' }}>
                {comment.userName}
              </h3>
              <p style={{ margin: '0 0 10px 0' }}>{comment.text}</p>
              <small style={{ color: '#888' }}>
                {new Date(comment.createdAt).toLocaleString()}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default App
