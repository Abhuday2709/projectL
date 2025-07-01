"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import MaxWidthWrapper from "@/components/MaxWidthWrapper";
import Sidebar from "@/components/Sidebar";
import {
    Users,
    Trash2,
    UserX,
    Calendar,
    Mail,
    Loader2,
    RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { User } from "../../../../models/userModel";

export default function UserManagementPage() {
    const { isLoaded, isSignedIn,userId } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (isLoaded && !isSignedIn) router.push("/sign-in");
    }, [isLoaded, isSignedIn, router]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/getAllUsers');
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            // Remove the current user from the list
            setUsers((data || []).filter((user: User) => user.user_id !== userId));
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load users. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            fetchUsers();
        }
    }, [isLoaded, isSignedIn]);

    const handleDeleteUser = async (user: User) => {
        setIsDeleting(true); 
        try {
            const response = await fetch(`/api/admin/deleteUser/${user.user_id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete user');
            setUsers(prev => prev.filter(u => u.user_id !== user.user_id));
            toast({
                title: 'Success',
                description: `User ${user.email} has been deleted successfully.`,
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to delete user. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsDeleting(false);
            setUserToDelete(null);
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    if (!isLoaded || !isSignedIn) return null;

    return (
        <div className="flex bg-[#F9F7F7] min-h-screen">
            <Sidebar />
            <div className="flex-1 lg:ml-64">
                <MaxWidthWrapper>
                    <div className="p-8">
                        {/* Header Section */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-gradient-to-r from-[#3F72AF] to-[#112D4E] rounded-xl shadow-lg">
                                        <Users className="h-7 w-7 text-white" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-bold text-[#112D4E]">User Management</h1>
                                        <p className="text-[#3F72AF] mt-1">
                                            {users.length} users
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={fetchUsers}
                                    variant="outline"
                                    className="border-[#DBE2EF] text-[#3F72AF] hover:bg-[#DBE2EF] hover:text-[#112D4E]"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Refresh
                                </Button>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <Card className="bg-white border-[#DBE2EF] shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-[#3F72AF]">Total Users</p>
                                                <p className="text-2xl font-bold text-[#112D4E]">{users.length}</p>
                                            </div>
                                            <div className="p-3 bg-[#DBE2EF] rounded-lg">
                                                <Users className="h-5 w-5 text-[#3F72AF]" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Users Table */}
                        <Card className="bg-white border-[#DBE2EF] shadow-lg">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-[#3F72AF]" />
                                    <span className="text-[#112D4E]">All Users</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="flex items-center gap-3 text-[#3F72AF]">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                            <span>Loading users...</span>
                                        </div>
                                    </div>
                                ) : users.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="p-4 bg-[#DBE2EF] rounded-full mb-4 w-fit mx-auto">
                                            <UserX className="h-8 w-8 text-[#3F72AF]" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-[#112D4E] mb-2">No Users Found</h3>
                                        <p className="text-[#3F72AF]">
                                            No users have been registered yet.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-[#DBE2EF]">
                                                    <TableHead className="text-[#112D4E] font-semibold">User</TableHead>
                                                    <TableHead className="text-[#112D4E] font-semibold">Email</TableHead>
                                                    <TableHead className="text-[#112D4E] font-semibold">Joined</TableHead>
                                                    <TableHead className="text-[#112D4E] font-semibold text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {users.map((user) => (
                                                    <TableRow
                                                        key={user.user_id}
                                                        className="border-[#DBE2EF] hover:bg-[#F9F7F7] transition-colors"
                                                    >
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-gradient-to-r from-[#3F72AF] to-[#112D4E] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                                                    {user.firstName
                                                                        ? user.firstName[0]
                                                                        : user.email
                                                                            ? user.email[0].toUpperCase()
                                                                            : "U"}
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-[#112D4E]">
                                                                        {user.firstName && user.lastName
                                                                            ? `${user.firstName} ${user.lastName}`
                                                                            : user.firstName
                                                                                ? user.firstName
                                                                                : user.email
                                                                                    ? user.email
                                                                                    : 'Unknown User'
                                                                        }
                                                                    </p>
                                                                    <p className="text-sm text-[#3F72AF]">ID: {user.user_id ? user.user_id.slice(0, 8) : "N/A"}...</p>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Mail className="h-4 w-4 text-[#3F72AF]" />
                                                                <span className="text-[#112D4E]">{user.email}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="h-4 w-4 text-[#3F72AF]" />
                                                                <span className="text-[#112D4E]">{formatDate(user.createdAt)}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setUserToDelete(user)}
                                                                className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-1" />
                                                                Delete
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Delete Confirmation Dialog */}
                        <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
                            <AlertDialogContent className="bg-white border-[#DBE2EF]">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                        <div className="p-2 bg-red-100 rounded-lg">
                                            <Trash2 className="h-4 w-4 text-red-600" />
                                        </div>
                                        <span className="text-[#112D4E]">Delete User?</span>
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-base text-[#3F72AF]">
                                        Are you sure you want to permanently delete{' '}
                                        <span className="font-semibold text-[#112D4E]">
                                            {userToDelete?.email}
                                        </span>
                                        ? This action cannot be undone and will remove all their data.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel
                                        className="border-[#DBE2EF] text-[#3F72AF] hover:bg-[#DBE2EF] hover:text-[#112D4E]"
                                        disabled={isDeleting}
                                    >
                                        Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        className="bg-red-600 hover:bg-red-700 text-white flex items-center"
                                        onClick={() => userToDelete && handleDeleteUser(userToDelete)}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        {isDeleting ? "Deleting..." : "Delete User"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </MaxWidthWrapper>
            </div>
        </div>
    );
}