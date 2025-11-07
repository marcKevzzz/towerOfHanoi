import { useState } from 'react'
import viteLogo from '/vite.svg'
import './App.css'
import TowerOfHanoi from './TowerOfHanoi'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <TowerOfHanoi/>
    </>
  )
}

export default App
