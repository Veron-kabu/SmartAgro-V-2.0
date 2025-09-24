import UserDashboard from './UserDashboard'

export default function BuyerDashboard() {
  return (
    <UserDashboard expectedRole="buyer" title="Buyer Profile" fallbackName="Buyer" />
  )
}
