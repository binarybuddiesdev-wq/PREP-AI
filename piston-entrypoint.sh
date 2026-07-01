#!/bin/bash

CGROUP_FS="/sys/fs/cgroup"
if [ ! -e "$CGROUP_FS" ]; then
  echo "Cannot find $CGROUP_FS. Please make sure your system is using cgroup v2"
  exit 1
fi

if [ -e "$CGROUP_FS/unified" ]; then
  echo "Combined cgroup v1+v2 mode is not supported. Please make sure your system is using pure cgroup v2"
  exit 1
fi

if [ ! -e "$CGROUP_FS/cgroup.subtree_control" ]; then
  echo "Cgroup v2 not found. Please make sure cgroup v2 is enabled on your system"
  exit 1
fi

cd /sys/fs/cgroup

# Read available controllers from cgroup.controllers
AVAILABLE_CONTROLLERS=$(cat cgroup.controllers)
echo "Available cgroup controllers: $AVAILABLE_CONTROLLERS"

# Filter out cpuset if it's not available, or construct the subtree control string
SUBTREE_CONTROL=""
for controller in cpuset cpu io memory pids; do
  if echo "$AVAILABLE_CONTROLLERS" | grep -q "$controller"; then
    SUBTREE_CONTROL="$SUBTREE_CONTROL +$controller"
  fi
done

mkdir -p isolate/
echo 1 > isolate/cgroup.procs
echo "$SUBTREE_CONTROL" > cgroup.subtree_control

cd isolate
mkdir -p init
echo 1 > init/cgroup.procs

# For isolate subtree_control, we want memory and cpuset if available
ISOLATE_SUBTREE=""
for controller in cpuset memory; do
  if echo "$AVAILABLE_CONTROLLERS" | grep -q "$controller"; then
    ISOLATE_SUBTREE="$ISOLATE_SUBTREE +$controller"
  fi
done
if [ -n "$ISOLATE_SUBTREE" ]; then
  echo "$ISOLATE_SUBTREE" > cgroup.subtree_control
fi

echo "Initialized cgroup with controllers: $SUBTREE_CONTROL"
chown -R piston:piston /piston
exec su -- piston -c 'ulimit -n 65536 && node /piston_api/src'
