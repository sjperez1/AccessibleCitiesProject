import React from 'react'
import '../views/home.css'
import Login from '../components/Login'
const Home = () => {
    return (
        <div>
            <div>
                <h1 className='hometext hometitle'>Accessible Cities</h1>
                <p className='hometext'>Ready to share your perspective on accessibility while traveling? You've come to the right place! To help others know what to expect about accessibility for different disabilties when going to a new place, you will be able to make a post detailing where you went, what accessibility features you looked for, a picture, and a longer description of your experience.</p>
                <p className='hometext'>All guests are free to browse the posts, but to create a new post, please log in or sign up.</p>
            </div>
            <Login/>
        </div>
    )
}

export default Home