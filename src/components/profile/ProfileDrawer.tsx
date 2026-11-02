import { Drawer } from '../common/Drawer'

interface ProfileDrawerProps {
  open: boolean
  onClose: () => void
}

export function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  return (
    <Drawer open={open} title="YOUR ACCOUNT" onClose={onClose}>
      <p className="small-note">Welcome to DUSKEO.</p>
      <p className="small-note">Customer accounts require a store backend.</p>
      <button className="outline" onClick={() => alert('Demo only: customer accounts are not connected.')}>
        SIGN IN / CREATE ACCOUNT
      </button>
    </Drawer>
  )
}
