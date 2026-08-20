import React from 'react'
import ReactDOM from 'react-dom/client'

// "Глубокие импорты", чтобы не ругался TypeScript
import { ApolloClient, InMemoryCache } from '@apollo/client/core'
import { ApolloProvider } from '@apollo/client/react'

// Теперь это стандартный чистый импорт!
// @ts-ignore
import { createUploadLink } from 'apollo-upload-client'

import App from './App.tsx'
import './index.css'

const client = new ApolloClient({
  link: createUploadLink({
    uri: 'http://localhost:8000/graphql/',
  }) as any,
  cache: new InMemoryCache(),
}) as any

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>,
)
