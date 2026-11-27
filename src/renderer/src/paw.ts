import { mount } from 'svelte'
import Paw from './Paw.svelte'

const target = document.getElementById('app')
if (!target) throw new Error('missing #app')
export default mount(Paw, { target })
