import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ssot/ui";

export function Placeholder({ title, description, specPath }: { title: string; description: string; specPath: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This route is scaffolded. Implementation will follow the corresponding page spec.
        </p>
        <p className="text-sm">
          Page spec: <code>{specPath}</code>
        </p>
      </CardContent>
    </Card>
  );
}
