import './lib/tokens.css'
import { mount } from 'svelte'
import Banner from './Banner.svelte'

const target = document.getElementById('app')
if (!target) throw new Error('missing #app')
export default mount(Banner, { target })
