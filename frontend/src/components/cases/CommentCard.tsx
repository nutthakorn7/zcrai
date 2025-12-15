import { useState } from 'react';
import { Card, CardBody, Button, Textarea, Avatar } from '@heroui/react';
import { Icon } from '../../shared/ui';

interface Comment {
  id: string;
  content: string;
  userEmail: string;
  createdAt: string;
  updatedAt?: string;
}

interface CommentCardProps {
  comment: Comment;
  currentUserEmail: string;
  onEdit: (id: string, newContent: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function highlightMentions(text: string): string {
  return text.replace(/@(\w+)/g, '<span class="text-primary font-semibold bg-primary/10 px-1 rounded">@$1</span>');
}

export function CommentCard({ comment, currentUserEmail, onEdit, onDelete }: CommentCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const isOwner = comment.userEmail === currentUserEmail;

  const handleSave = async () => {
    if (!editContent.trim()) return;
    await onEdit(comment.id, editContent);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const getUserInitials = (email: string) => {
    const name = email.split('@')[0];
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Card className="bg-content2/50 hover:bg-content2/70 transition-all group">
      <CardBody className="py-3 px-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-3">
            <Avatar 
              name={getUserInitials(comment.userEmail)} 
              size="sm"
              className="bg-primary/20 text-primary"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{comment.userEmail}</span>
                <span className="text-xs text-foreground/50">
                  {formatRelativeTime(comment.createdAt)}
                </span>
                {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                  <span className="text-xs text-foreground/40 italic">(edited)</span>
                )}
              </div>
            </div>
          </div>
          
          {isOwner && !isEditing && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                size="sm" 
                variant="light" 
                isIconOnly
                onPress={() => setIsEditing(true)}
                className="h-7 min-w-7"
              >
                <Icon.Edit className="w-3 h-3" />
              </Button>
              <Button 
                size="sm" 
                variant="light" 
                color="danger"
                isIconOnly
                isLoading={isDeleting}
                onPress={handleDelete}
                className="h-7 min-w-7"
              >
                <Icon.Delete className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2 mt-2">
            <Textarea
              value={editContent}
              onValueChange={setEditContent}
              minRows={3}
              variant="bordered"
              placeholder="Edit your comment..."
            />
            <div className="flex gap-2 justify-end">
              <Button 
                size="sm" 
                variant="flat" 
                onPress={() => {
                  setEditContent(comment.content);
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                color="primary"
                onPress={handleSave}
                isDisabled={!editContent.trim()}
              >
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <div 
            className="prose prose-sm prose-invert max-w-none text-foreground/90"
            dangerouslySetInnerHTML={{ 
              __html: highlightMentions(comment.content) 
            }}
          />
        )}
      </CardBody>
    </Card>
  );
}
