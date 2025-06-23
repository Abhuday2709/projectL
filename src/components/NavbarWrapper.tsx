"use client"

import { usePathname } from "next/navigation"
import Navbar from "./Navbar"

const NavbarWrapper = () => {
    const pathname = usePathname()
    const isDashboard = pathname.startsWith('/s/')
    if (!isDashboard) return null
    return (
       <Navbar/>
    )
}
export default NavbarWrapper